-- PLAN-035: invitations 테이블 + generate_invite_code() 함수
-- admin 초대 코드 발급 시스템

CREATE TABLE IF NOT EXISTS public.invitations (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code           text        UNIQUE NOT NULL,
  intended_email text,
  created_by     uuid        REFERENCES public.users(id),
  used_by        uuid        REFERENCES public.users(id),
  used_at        timestamptz,
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON public.invitations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_invitations_code       ON public.invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON public.invitations(expires_at);

-- 16자 hex 초대 코드 생성 함수
-- gen_random_uuid() 는 PostgreSQL 13+ 코어 내장 — pgcrypto 확장 불요.
-- (구: encode(gen_random_bytes(8),'hex') — pgcrypto 미활성 환경에서 실패하여 교체)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text LANGUAGE sql AS $$
  SELECT substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
$$;
