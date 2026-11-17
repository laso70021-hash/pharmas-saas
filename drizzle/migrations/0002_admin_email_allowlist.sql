CREATE TABLE public.admin_email_allowlist (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_email_allowlist TO service_role;
ALTER TABLE public.admin_email_allowlist ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.admin_email_allowlist IS 'Emails that receive super_admin once their address is confirmed. No client access.';

CREATE OR REPLACE FUNCTION public.grant_allowlisted_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.admin_email_allowlist a WHERE lower(a.email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.grant_allowlisted_admin() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_admin_allowlist_insert
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_allowlisted_admin();

CREATE TRIGGER on_auth_user_admin_allowlist_confirm
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_allowlisted_admin();