-- PLAN-028 initial schema (A.1 서버 MVP)
-- 의존: PLAN-P0-multitenant-schema §4.1, PLAN-P0-quota-policy §4.3, PLAN-P0-auth-flow §4.8
-- v1.1 정합: user·admin 2단계 role, 3채널 기여 모델, 공용 쓰기 Edge Function(service_role) 독점

-- ============================================================
-- 1) users — Supabase auth.users 1:1 확장
-- ============================================================
CREATE TABLE public.users (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text        NOT NULL UNIQUE,
  role          text        NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- ============================================================
-- 2) conferences_upstream — 공용 ground truth
-- ============================================================
CREATE TABLE public.conferences_upstream (
  id                  text        PRIMARY KEY,
  category            text        NOT NULL CHECK (category IN ('학회','박람회')),
  field               text        NOT NULL,
  abbreviation        text,
  full_name           text        NOT NULL,
  cycle_years         smallint    NOT NULL CHECK (cycle_years >= 0),
  duration_days       smallint    NOT NULL CHECK (duration_days >= 0),
  region              text,
  official_url        text,
  note                text,
  organizer           text,
  found_at            timestamptz,
  last_ai_update_at   timestamptz,
  last_editor_id      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conferences_upstream_field_idx ON public.conferences_upstream(field);
CREATE INDEX conferences_upstream_last_ai_update_idx ON public.conferences_upstream(last_ai_update_at);

-- ============================================================
-- 3) editions_upstream — 공용 (conference 별 회차)
-- ============================================================
CREATE TABLE public.editions_upstream (
  id              text        PRIMARY KEY,
  conference_id   text        NOT NULL REFERENCES public.conferences_upstream(id) ON DELETE CASCADE,
  status          text        NOT NULL CHECK (status IN ('upcoming','past','unknown')),
  start_date      date,
  end_date        date,
  venue           text,
  link            text,
  source          text        NOT NULL CHECK (source IN ('ai_search','user_input','backfill','initial_import')),
  confidence      text        CHECK (confidence IS NULL OR confidence IN ('high','medium','low')),
  notes           text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX editions_upstream_conf_status_idx ON public.editions_upstream(conference_id, status);
CREATE INDEX editions_upstream_start_date_idx ON public.editions_upstream(start_date);

-- ============================================================
-- 4) user_conferences — 개인 레이어 (sparse)
-- ============================================================
CREATE TABLE public.user_conferences (
  user_id        uuid        REFERENCES public.users(id) ON DELETE CASCADE,
  conference_id  text        REFERENCES public.conferences_upstream(id) ON DELETE CASCADE,
  starred        smallint    NOT NULL DEFAULT 0 CHECK (starred IN (0,1)),
  personal_note  text,
  overrides      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conference_id)
);

CREATE INDEX user_conferences_starred_idx ON public.user_conferences(user_id, starred) WHERE starred = 1;

-- ============================================================
-- 5) api_usage_log — 호출 이력 (append-only)
-- ============================================================
CREATE TABLE public.api_usage_log (
  id                bigserial   PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ts                timestamptz NOT NULL DEFAULT now(),
  endpoint          text        NOT NULL CHECK (endpoint IN ('update','discovery_expand','discovery_search','verify')),
  conference_id     text        REFERENCES public.conferences_upstream(id) ON DELETE SET NULL,
  input_tokens      int         NOT NULL DEFAULT 0,
  output_tokens     int         NOT NULL DEFAULT 0,
  web_searches      int         NOT NULL DEFAULT 0,
  cache_hit_tokens  int         NOT NULL DEFAULT 0,
  cost_usd          numeric(10,6) NOT NULL DEFAULT 0,
  status            text        NOT NULL CHECK (status IN ('success','error','quota_block','cached'))
);

CREATE INDEX api_usage_log_user_ts_idx    ON public.api_usage_log(user_id, ts DESC);
CREATE INDEX api_usage_log_ts_idx         ON public.api_usage_log(ts);
CREATE INDEX api_usage_log_monthly_idx    ON public.api_usage_log(user_id, endpoint, date_trunc('month', ts));

-- ============================================================
-- 6) quotas — 사용자별 현재 주기 사용량 (dual counter)
-- ============================================================
CREATE TABLE public.quotas (
  user_id         uuid        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  period_start    date        NOT NULL DEFAULT (date_trunc('month', now() AT TIME ZONE 'Asia/Seoul'))::date,
  update_used     smallint    NOT NULL DEFAULT 0 CHECK (update_used >= 0),
  update_limit    smallint    NOT NULL DEFAULT 10 CHECK (update_limit >= 0),
  discovery_used  smallint    NOT NULL DEFAULT 0 CHECK (discovery_used >= 0),
  discovery_limit smallint    NOT NULL DEFAULT 3 CHECK (discovery_limit >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- updated_at 자동 갱신 trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER conferences_upstream_updated_at
  BEFORE UPDATE ON public.conferences_upstream
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER editions_upstream_updated_at
  BEFORE UPDATE ON public.editions_upstream
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_conferences_updated_at
  BEFORE UPDATE ON public.user_conferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER quotas_updated_at
  BEFORE UPDATE ON public.quotas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- auth.users → public.users, public.quotas 자동 생성 trigger
-- PLAN-P0-auth-flow §4.8
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.handle_auth_user_login()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE public.users SET last_login_at = NEW.last_sign_in_at WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_login();

-- ============================================================
-- RLS 활성화 + 정책 (PLAN-P0-multitenant-schema §4.2 매트릭스)
-- ============================================================
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conferences_upstream   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editions_upstream      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_conferences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotas                 ENABLE ROW LEVEL SECURITY;

-- users: 본인 SELECT/UPDATE (role 열은 제외 — trigger 로 보호), admin 전체 SELECT
CREATE POLICY users_self_read ON public.users
  FOR SELECT USING (id = auth.uid());
CREATE POLICY users_self_update ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY users_admin_read ON public.users
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- role 변경 방지: 자기 자신이 role 을 바꾸지 못하도록 trigger
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'role 은 admin 만 변경할 수 있습니다';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_prevent_self_role_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

-- conferences_upstream: 읽기 전원, 쓰기는 service_role 만 (RLS 정책 없음으로 block)
CREATE POLICY cu_read ON public.conferences_upstream
  FOR SELECT USING (true);

-- editions_upstream: 읽기 전원, 쓰기는 service_role 만
CREATE POLICY eu_read ON public.editions_upstream
  FOR SELECT USING (true);

-- user_conferences: 본인 CRUD 전체
CREATE POLICY uc_self_all ON public.user_conferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- api_usage_log: 본인 SELECT, INSERT 는 service_role 만, admin 전체 SELECT
CREATE POLICY aul_self_read ON public.api_usage_log
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY aul_admin_read ON public.api_usage_log
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- quotas: 본인 SELECT, UPDATE/INSERT 는 service_role 만, admin 전체 SELECT + limit UPDATE
CREATE POLICY q_self_read ON public.quotas
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY q_admin_read ON public.quotas
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
CREATE POLICY q_admin_update ON public.quotas
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- ============================================================
-- Edge Function 이 호출하는 RPC (service_role 로 실행)
-- ============================================================

-- consume_quota: 월초 lazy reset + 원자적 차감. RETURNING 으로 성공/실패 판단.
CREATE OR REPLACE FUNCTION public.consume_quota(
  p_user_id  uuid,
  p_endpoint text
) RETURNS TABLE (
  allowed        boolean,
  update_used    smallint,
  update_limit   smallint,
  discovery_used smallint,
  discovery_limit smallint,
  period_start   date
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_month_start date := (date_trunc('month', now() AT TIME ZONE 'Asia/Seoul'))::date;
  v_counter     text;
BEGIN
  -- 1) Lazy reset: period_start 가 이전 달이면 counters 초기화
  UPDATE public.quotas
  SET update_used    = CASE WHEN period_start < v_month_start THEN 0 ELSE update_used END,
      discovery_used = CASE WHEN period_start < v_month_start THEN 0 ELSE discovery_used END,
      period_start   = GREATEST(period_start, v_month_start),
      updated_at     = now()
  WHERE user_id = p_user_id;

  -- 2) endpoint → counter 매핑
  v_counter := CASE
    WHEN p_endpoint IN ('update','verify')                         THEN 'update'
    WHEN p_endpoint IN ('discovery_expand','discovery_search')     THEN 'discovery'
    ELSE NULL
  END;

  IF v_counter IS NULL THEN
    RAISE EXCEPTION 'unknown endpoint: %', p_endpoint;
  END IF;

  -- 3) 원자적 차감 (admin 은 실질 무제한 = 999)
  IF v_counter = 'update' THEN
    UPDATE public.quotas
    SET update_used = update_used + 1,
        updated_at  = now()
    WHERE user_id = p_user_id AND update_used < update_limit;
  ELSE
    UPDATE public.quotas
    SET discovery_used = discovery_used + 1,
        updated_at     = now()
    WHERE user_id = p_user_id AND discovery_used < discovery_limit;
  END IF;

  -- 4) 결과 조회
  RETURN QUERY
    SELECT (CASE
              WHEN v_counter = 'update'    THEN q.update_used    <= q.update_limit
              WHEN v_counter = 'discovery' THEN q.discovery_used <= q.discovery_limit
            END) AS allowed,
           q.update_used, q.update_limit,
           q.discovery_used, q.discovery_limit,
           q.period_start
    FROM public.quotas q
    WHERE q.user_id = p_user_id;
END;
$$;

-- refund_quota: API 호출 실패 시 보상 트랜잭션
CREATE OR REPLACE FUNCTION public.refund_quota(
  p_user_id  uuid,
  p_endpoint text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_endpoint IN ('update','verify') THEN
    UPDATE public.quotas
    SET update_used = GREATEST(update_used - 1, 0), updated_at = now()
    WHERE user_id = p_user_id;
  ELSIF p_endpoint IN ('discovery_expand','discovery_search') THEN
    UPDATE public.quotas
    SET discovery_used = GREATEST(discovery_used - 1, 0), updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- monthly_budget_used: 이번 달 전체 비용 합계 (예산 상한 체크용)
CREATE OR REPLACE FUNCTION public.monthly_budget_used()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(cost_usd), 0)
  FROM public.api_usage_log
  WHERE ts >= (date_trunc('month', now() AT TIME ZONE 'Asia/Seoul'));
$$;
