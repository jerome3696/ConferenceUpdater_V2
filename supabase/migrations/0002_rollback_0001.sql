-- PLAN-028 rollback of 0001_initial_schema.sql
-- 수동 실행 전용 — 프로덕션 데이터 유실 확인 후 적용

DROP FUNCTION IF EXISTS public.monthly_budget_used();
DROP FUNCTION IF EXISTS public.refund_quota(uuid, text);
DROP FUNCTION IF EXISTS public.consume_quota(uuid, text);

DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_auth_user_login();
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

DROP TABLE IF EXISTS public.api_usage_log CASCADE;
DROP TABLE IF EXISTS public.user_conferences CASCADE;
DROP TABLE IF EXISTS public.quotas CASCADE;
DROP TABLE IF EXISTS public.editions_upstream CASCADE;
DROP TABLE IF EXISTS public.conferences_upstream CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

DROP FUNCTION IF EXISTS public.prevent_self_role_change();
DROP FUNCTION IF EXISTS public.set_updated_at();
