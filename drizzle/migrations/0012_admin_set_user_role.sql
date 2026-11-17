CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role public.user_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Only platform admins can change roles'; END IF;
  IF _user_id = auth.uid() AND _role <> 'super_admin' THEN RAISE EXCEPTION 'You cannot remove your own admin access'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN RAISE EXCEPTION 'User not found'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role);
  INSERT INTO public.audit_logs(user_id, action, entity, entity_id, details)
  VALUES (auth.uid(), 'role_changed', 'user_roles', _user_id::text, jsonb_build_object('role', _role));
END $$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.user_role) TO authenticated;