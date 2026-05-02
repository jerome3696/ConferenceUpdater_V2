-- PLAN-029 hotfix: consume_quota 함수의 column ambiguity 제거.
-- RETURNS TABLE(period_start date, update_used smallint, ...) 의 OUT 파라미터들이 PL/pgSQL 함수 본문에서
-- 변수로 노출되어 같은 이름의 테이블 컬럼과 충돌 → 42702 ambiguous column reference.
-- 테이블 alias q. 를 모든 컬럼 참조에 명시적으로 붙여 해결.

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
  UPDATE public.quotas q
  SET update_used    = CASE WHEN q.period_start < v_month_start THEN 0 ELSE q.update_used END,
      discovery_used = CASE WHEN q.period_start < v_month_start THEN 0 ELSE q.discovery_used END,
      period_start   = GREATEST(q.period_start, v_month_start),
      updated_at     = now()
  WHERE q.user_id = p_user_id;

  v_counter := CASE
    WHEN p_endpoint IN ('update','verify')                         THEN 'update'
    WHEN p_endpoint IN ('discovery_expand','discovery_search')     THEN 'discovery'
    ELSE NULL
  END;

  IF v_counter IS NULL THEN
    RAISE EXCEPTION 'unknown endpoint: %', p_endpoint;
  END IF;

  IF v_counter = 'update' THEN
    UPDATE public.quotas q
    SET update_used = q.update_used + 1,
        updated_at  = now()
    WHERE q.user_id = p_user_id AND q.update_used < q.update_limit;
  ELSE
    UPDATE public.quotas q
    SET discovery_used = q.discovery_used + 1,
        updated_at     = now()
    WHERE q.user_id = p_user_id AND q.discovery_used < q.discovery_limit;
  END IF;

  RETURN QUERY
    SELECT (CASE
              WHEN v_counter = 'update'    THEN q.update_used    <= q.update_limit
              WHEN v_counter = 'discovery' THEN q.discovery_used <= q.discovery_limit
            END),
           q.update_used, q.update_limit,
           q.discovery_used, q.discovery_limit,
           q.period_start
    FROM public.quotas q
    WHERE q.user_id = p_user_id;
END;
$$;
