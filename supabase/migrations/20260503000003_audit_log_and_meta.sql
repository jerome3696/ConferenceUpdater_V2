-- PLAN-031: audit_log + conferences_upstream 메타 컬럼 + bump_edit_meta trigger
-- blueprint v2 §5.2~§5.3 — 공용 DB 변경 추적 인프라
-- live 적용 안 함 — 사용자 morning review 후 적용

-- §4.1-A: conferences_upstream 메타 컬럼 추가
ALTER TABLE public.conferences_upstream
  ADD COLUMN edited_count   int         NOT NULL DEFAULT 0,
  ADD COLUMN last_edited_at timestamptz;

-- §4.1-B: audit_log 테이블
CREATE TABLE public.audit_log (
  id            bigserial   PRIMARY KEY,
  user_id       uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  conference_id text        NOT NULL REFERENCES public.conferences_upstream(id) ON DELETE CASCADE,
  field         text        NOT NULL,
  old_value     text,
  new_value     text,
  ts            timestamptz NOT NULL DEFAULT now(),
  source        text        NOT NULL CHECK (source IN ('manual','ai_search','admin')),
  endpoint      text
);

CREATE INDEX audit_log_conf_ts_idx ON public.audit_log(conference_id, ts DESC);
CREATE INDEX audit_log_user_ts_idx ON public.audit_log(user_id, ts DESC);

-- §4.1-C: RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 본인 행만 SELECT (user_id = auth.uid())
CREATE POLICY al_self_read ON public.audit_log
  FOR SELECT USING (user_id = auth.uid());

-- admin 전체 SELECT (is_admin 헬퍼 재사용 — 20260503000001 에서 정의)
CREATE POLICY al_admin_read ON public.audit_log
  FOR SELECT USING (public.is_admin(auth.uid()));

-- INSERT 정책 없음 → service_role 만 INSERT 가능 (Edge Function 의 AI 흐름이 호출)

-- §4.2: 메타 자동 갱신 trigger
CREATE OR REPLACE FUNCTION public.bump_edit_meta()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conferences_upstream
    SET edited_count   = edited_count + 1,
        last_edited_at = NEW.ts,
        last_editor_id = NEW.user_id
    WHERE id = NEW.conference_id;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_log_bump_meta
  AFTER INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.bump_edit_meta();
