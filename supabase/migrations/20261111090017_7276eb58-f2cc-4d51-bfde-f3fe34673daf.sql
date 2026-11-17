DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '25abb0d6-3fa5-48dd-85f0-4ebbaea48a27' AND lower(email) = 'issambwana092@gmail.com' AND email_confirmed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Administrator account must match the requested ID and confirmed email';
 END IF;
 INSERT INTO public.user_roles(user_id, role) VALUES ('25abb0d6-3fa5-48dd-85f0-4ebbaea48a27','super_admin') ON CONFLICT (user_id,role) DO NOTHING;
 IF NOT public.has_role('25abb0d6-3fa5-48dd-85f0-4ebbaea48a27','super_admin') THEN RAISE EXCEPTION 'Administrator assignment verification failed'; END IF;
END $$;