CREATE OR REPLACE FUNCTION public.guard_pharmacy_billing_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_platform_admin() OR current_setting('app.registration_write', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.trial_ends_at := NULL;
    NEW.subscription_ends_at := NULL;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.review_note := NULL;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.billing_choice IS DISTINCT FROM OLD.billing_choice
     OR NEW.business_type IS DISTINCT FROM OLD.business_type
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.review_note IS DISTINCT FROM OLD.review_note
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Only an administrator can change plan, approval or billing details';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_pharmacy_billing_fields() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_registration(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  -- create_registration always writes status 'pending'; allow that write past the guard.
  PERFORM set_config('app.registration_write', 'on', true);
  v_id := public.create_registration(auth.uid(), _payload);
  PERFORM set_config('app.registration_write', 'off', true);
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_registration(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_registration(jsonb) TO authenticated;
