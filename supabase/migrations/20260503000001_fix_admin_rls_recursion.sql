-- PLAN-029 hotfix: admin-read RLS 재귀 제거.
-- 기존 정책은 EXISTS(SELECT 1 FROM public.users WHERE role='admin') 형태로 작성됐지만,
-- public.users 의 users_admin_read 가 또 같은 SELECT 를 트리거 → infinite recursion → 500.
-- SECURITY DEFINER 함수로 감싸 inner SELECT 가 RLS 를 우회하도록 변경.

DROP POLICY IF EXISTS users_admin_read ON public.users;
DROP POLICY IF EXISTS q_admin_read ON public.quotas;
DROP POLICY IF EXISTS q_admin_update ON public.quotas;
DROP POLICY IF EXISTS aul_admin_read ON public.api_usage_log;

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = uid AND role = 'admin');
$$;

CREATE POLICY users_admin_read ON public.users
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY q_admin_read ON public.quotas
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY q_admin_update ON public.quotas
  FOR UPDATE USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY aul_admin_read ON public.api_usage_log
  FOR SELECT USING (public.is_admin(auth.uid()));
