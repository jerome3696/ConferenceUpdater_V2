-- PLAN-030: 라이브러리 스키마 + 사용자 구독 + 옵트인 동기화
-- blueprint v3 §1.5 (참조 모델·생애주기) · §2.4 (라이브러리 모델)
-- 의존: 20260422000001_initial_schema.sql (users, conferences_upstream, handle_new_auth_user)

-- ============================================================
-- 1) libraries — 라이브러리 (admin 큐레이팅 + 사용자별 가상 "내 학회")
-- ============================================================
CREATE TABLE public.libraries (
  id            text        PRIMARY KEY,
  name          text        NOT NULL,
  description   text,
  is_virtual    boolean     NOT NULL DEFAULT false,             -- "내 학회" 가상 라이브러리면 true
  owner_user_id uuid        REFERENCES public.users(id) ON DELETE CASCADE, -- 가상만 NOT NULL
  lifecycle     text        NOT NULL DEFAULT 'building'
                  CHECK (lifecycle IN ('building','operating')), -- §1.5.3 생애주기. 운영기 자동화는 후속 PLAN
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2) library_conferences — 라이브러리 ↔ 학회 태그 (다대다, 참조 모델 §1.5.1)
-- ============================================================
CREATE TABLE public.library_conferences (
  library_id    text        REFERENCES public.libraries(id) ON DELETE CASCADE,
  conference_id text        REFERENCES public.conferences_upstream(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (library_id, conference_id)
);

-- "이 학회가 속한 라이브러리들" 역방향 조회 (뱃지 렌더링)
CREATE INDEX library_conferences_conf_idx ON public.library_conferences(conference_id);

-- ============================================================
-- 3) user_libraries — 사용자별 라이브러리 구독
-- ============================================================
CREATE TABLE public.user_libraries (
  user_id       uuid        REFERENCES public.users(id) ON DELETE CASCADE,
  library_id    text        REFERENCES public.libraries(id) ON DELETE CASCADE,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),  -- 옵트인 동기화 baseline (§4.3)
  PRIMARY KEY (user_id, library_id)
);

-- ============================================================
-- 4) handle_new_auth_user 확장 — 가입 시 개인 가상 라이브러리 자동 생성
--    (initial_schema 의 함수를 재정의. trigger on_auth_user_created 는 그대로 유지)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.quotas (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- PLAN-030: 개인 가상 라이브러리 ("내 학회")
  INSERT INTO public.libraries (id, name, is_virtual, owner_user_id)
  VALUES ('lib_personal_' || NEW.id::text, '내 학회', true, NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 기존 사용자 backfill — 가상 라이브러리 소급 생성
INSERT INTO public.libraries (id, name, is_virtual, owner_user_id)
  SELECT 'lib_personal_' || id::text, '내 학회', true, id
  FROM public.users
  ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5) RLS
-- ============================================================
ALTER TABLE public.libraries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_libraries      ENABLE ROW LEVEL SECURITY;

-- libraries: 비가상(admin 라이브러리)은 전원 SELECT, 가상은 소유자만.
--   쓰기 정책 없음 → 비가상 라이브러리 생성·편집은 service_role/admin(후속 PLAN-035).
--   가상 라이브러리는 handle_new_auth_user(SECURITY DEFINER)가 생성.
CREATE POLICY lib_read ON public.libraries
  FOR SELECT USING (is_virtual = false OR owner_user_id = auth.uid());

-- library_conferences: 보이는 라이브러리의 태그만 SELECT.
CREATE POLICY lc_read ON public.library_conferences
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.libraries l
    WHERE l.id = library_conferences.library_id
      AND (l.is_virtual = false OR l.owner_user_id = auth.uid())
  ));

-- library_conferences: 본인 가상 라이브러리("내 학회")의 태그는 본인이 CRUD (D2/D3 적재).
CREATE POLICY lc_virtual_owner_write ON public.library_conferences
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.libraries l
    WHERE l.id = library_conferences.library_id
      AND l.is_virtual = true AND l.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.libraries l
    WHERE l.id = library_conferences.library_id
      AND l.is_virtual = true AND l.owner_user_id = auth.uid()
  ));

-- user_libraries: 본인 구독 CRUD 전체.
CREATE POLICY ul_self_all ON public.user_libraries
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 6) master 라이브러리 시드 — 현재 conferences_upstream 전체를 master 에 매핑
--    (Phase B 의 공조·디지털트윈 등 분야 분리는 admin 페이지에서 추가)
-- ============================================================
INSERT INTO public.libraries (id, name, description, is_virtual, lifecycle)
  VALUES ('lib_master', '마스터', '운영자 큐레이팅 메인 라이브러리 (열유체·건물공조)', false, 'building');

INSERT INTO public.library_conferences (library_id, conference_id)
  SELECT 'lib_master', id FROM public.conferences_upstream;

-- ============================================================
-- 롤백 (PLAN-030 §7) — 수동 적용용. 적용 순서 역순.
-- ------------------------------------------------------------
-- DROP TABLE IF EXISTS public.user_libraries;
-- DROP TABLE IF EXISTS public.library_conferences;
-- DROP TABLE IF EXISTS public.libraries;
-- -- handle_new_auth_user 는 initial_schema 정의로 수동 복원 필요 (libraries INSERT 블록 제거).
-- ============================================================
