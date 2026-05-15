-- PLAN-034: calendar_token for ICS subscription URL

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS calendar_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_calendar_token ON public.users(calendar_token);

-- Generates a 32-char hex token, saves it to users, returns it.
-- Callable by authenticated users (with internal auth.uid() guard).
CREATE OR REPLACE FUNCTION public.regenerate_calendar_token(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  -- Only allow users to regenerate their own token.
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_token := encode(
    sha256((random()::text || p_user_id::text)::bytea),
    'hex'
  );
  -- Take first 32 chars for a shorter URL.
  v_token := left(v_token, 32);

  UPDATE public.users
  SET calendar_token = v_token
  WHERE id = p_user_id;

  RETURN v_token;
END;
$$;

-- Authenticated users can call this for themselves (auth.uid() guard is inside function).
GRANT EXECUTE ON FUNCTION public.regenerate_calendar_token(uuid) TO authenticated;
-- Revoke from public just in case.
REVOKE EXECUTE ON FUNCTION public.regenerate_calendar_token(uuid) FROM PUBLIC;
