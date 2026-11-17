ALTER TYPE public.pharmacy_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'pharmacy',
  ADD COLUMN IF NOT EXISTS billing_choice text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE public.pharmacies ADD CONSTRAINT pharmacies_business_type_check CHECK (business_type IN ('pharmacy','supplier'));
ALTER TABLE public.pharmacies ADD CONSTRAINT pharmacies_billing_choice_check CHECK (billing_choice IN ('trial','annual'));
ALTER TABLE public.pharmacies ALTER COLUMN trial_ends_at DROP DEFAULT;
ALTER TABLE public.pharmacies ALTER COLUMN status SET DEFAULT 'pending';

-- Subscription payments (proof of yearly payment, verified by an administrator)
CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  amount_tzs numeric(15,2) NOT NULL DEFAULT 0,
  period_months integer NOT NULL DEFAULT 12,
  method text NOT NULL DEFAULT 'mobile_money',
  reference text,
  receipt_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  submitted_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payments readable by owner or admin" ON public.subscription_payments FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = pharmacy_id AND p.owner_id = auth.uid()));
CREATE INDEX subscription_payments_pharmacy_idx ON public.subscription_payments(pharmacy_id, created_at DESC);

-- Only administrators may change approval / billing fields on a business
CREATE OR REPLACE FUNCTION public.guard_pharmacy_billing_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_platform_admin() THEN
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
CREATE TRIGGER pharmacies_guard_billing
  BEFORE INSERT OR UPDATE ON public.pharmacies
  FOR EACH ROW EXECUTE FUNCTION public.guard_pharmacy_billing_fields();

-- Yearly price for a plan: discounted monthly rate x 12
CREATE OR REPLACE FUNCTION public.plan_yearly_price(_plan_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(price_tzs_annual, 0), price_tzs_monthly, 0) * 12 FROM public.subscription_plans WHERE id = _plan_id
$$;
REVOKE EXECUTE ON FUNCTION public.plan_yearly_price(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_yearly_price(uuid) TO authenticated;

-- Shared registration logic (used by the signup trigger and by signed-in users)
CREATE OR REPLACE FUNCTION public.create_registration(_user_id uuid, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_type text := COALESCE(NULLIF(_payload->>'business_type',''), 'pharmacy');
  v_billing text := COALESCE(NULLIF(_payload->>'billing_choice',''), 'trial');
  v_existing public.pharmacies%ROWTYPE;
  v_id uuid;
  v_email text;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF v_type NOT IN ('pharmacy','supplier') THEN v_type := 'pharmacy'; END IF;
  IF COALESCE(trim(_payload->>'business_name'),'') = '' THEN RAISE EXCEPTION 'Business name is required'; END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE slug = COALESCE(_payload->>'plan_slug','starter') AND is_active IS NOT FALSE;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Please choose a valid plan'; END IF;
  -- Only Starter offers the free 30-day trial; every other plan is paid yearly.
  IF v_plan.slug <> 'starter' THEN v_billing := 'annual'; END IF;
  IF v_billing NOT IN ('trial','annual') THEN v_billing := 'trial'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = _user_id;

  SELECT * INTO v_existing FROM public.pharmacies WHERE owner_id = _user_id ORDER BY created_at DESC LIMIT 1;
  IF v_existing.id IS NOT NULL AND v_existing.status::text <> 'rejected' THEN
    RAISE EXCEPTION 'This account already has a registration';
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.pharmacies SET
      name = trim(_payload->>'business_name'),
      business_type = v_type,
      plan_id = v_plan.id,
      billing_choice = v_billing,
      phone = NULLIF(_payload->>'phone',''),
      city = COALESCE(NULLIF(_payload->>'city',''), 'Dar es Salaam'),
      address = NULLIF(_payload->>'address',''),
      registration_number = NULLIF(_payload->>'registration_number',''),
      tax_number = NULLIF(_payload->>'tax_number',''),
      owner_name = NULLIF(_payload->>'owner_name',''),
      status = 'pending',
      review_note = NULL,
      updated_at = now()
    WHERE id = v_existing.id;
    v_id := v_existing.id;
  ELSE
    INSERT INTO public.pharmacies (name, business_type, plan_id, billing_choice, email, phone, city, address,
                                   registration_number, tax_number, owner_name, owner_id, status)
    VALUES (trim(_payload->>'business_name'), v_type, v_plan.id, v_billing, v_email,
            NULLIF(_payload->>'phone',''), COALESCE(NULLIF(_payload->>'city',''), 'Dar es Salaam'),
            NULLIF(_payload->>'address',''), NULLIF(_payload->>'registration_number',''),
            NULLIF(_payload->>'tax_number',''), NULLIF(_payload->>'owner_name',''), _user_id, 'pending')
    RETURNING id INTO v_id;
  END IF;

  IF v_billing = 'annual' AND COALESCE(trim(_payload->>'payment_reference'),'') <> '' THEN
    INSERT INTO public.subscription_payments (pharmacy_id, plan_id, amount_tzs, method, reference, submitted_by)
    VALUES (v_id, v_plan.id, public.plan_yearly_price(v_plan.id),
            COALESCE(NULLIF(_payload->>'payment_method',''), 'mobile_money'),
            trim(_payload->>'payment_reference'), _user_id);
  END IF;

  INSERT INTO public.audit_logs (pharmacy_id, user_id, action, entity, entity_id, details)
  VALUES (v_id, _user_id, 'registration_submitted', 'pharmacy', v_id::text,
          jsonb_build_object('plan', v_plan.slug, 'billing', v_billing, 'type', v_type));
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_registration(uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_registration(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.create_registration(auth.uid(), _payload);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_registration(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_registration(jsonb) TO authenticated;

-- Owner submits yearly payment proof (reference and/or receipt)
CREATE OR REPLACE FUNCTION public.submit_subscription_payment(_pharmacy_id uuid, _plan_slug text, _method text, _reference text, _receipt_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan_id uuid;
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pharmacies WHERE id = _pharmacy_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'You can only pay for your own business';
  END IF;
  IF COALESCE(trim(_reference),'') = '' AND COALESCE(trim(_receipt_path),'') = '' THEN
    RAISE EXCEPTION 'Add a payment reference or upload a receipt';
  END IF;
  IF _receipt_path IS NOT NULL AND _receipt_path <> '' AND split_part(_receipt_path, '/', 1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'Invalid receipt';
  END IF;
  SELECT id INTO v_plan_id FROM public.subscription_plans WHERE slug = _plan_slug;
  IF v_plan_id IS NULL THEN
    SELECT plan_id INTO v_plan_id FROM public.pharmacies WHERE id = _pharmacy_id;
  END IF;
  INSERT INTO public.subscription_payments (pharmacy_id, plan_id, amount_tzs, method, reference, receipt_path, submitted_by)
  VALUES (_pharmacy_id, v_plan_id, public.plan_yearly_price(v_plan_id), COALESCE(NULLIF(_method,''),'mobile_money'),
          NULLIF(trim(_reference),''), NULLIF(_receipt_path,''), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.audit_logs (pharmacy_id, user_id, action, entity, entity_id, details)
  VALUES (_pharmacy_id, auth.uid(), 'payment_submitted', 'subscription_payment', v_id::text, '{}'::jsonb);
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_subscription_payment(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_subscription_payment(uuid, text, text, text, text) TO authenticated;

-- Admin: approve / reject a registration
CREATE OR REPLACE FUNCTION public.review_registration(_pharmacy_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ph public.pharmacies%ROWTYPE;
  v_trial_days integer;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT * INTO v_ph FROM public.pharmacies WHERE id = _pharmacy_id;
  IF v_ph.id IS NULL THEN RAISE EXCEPTION 'Registration not found'; END IF;

  IF _decision = 'approve' THEN
    SELECT COALESCE((value->>'pharmacy_trial_days')::int, 30) INTO v_trial_days FROM public.platform_settings WHERE key = 'monetization';
    v_trial_days := COALESCE(v_trial_days, 30);
    IF v_ph.billing_choice = 'trial' THEN
      UPDATE public.pharmacies SET status = 'trial', trial_ends_at = now() + make_interval(days => v_trial_days),
        approved_at = now(), approved_by = auth.uid(), review_note = _note, updated_at = now()
      WHERE id = _pharmacy_id;
    ELSE
      UPDATE public.pharmacies SET status = 'active',
        subscription_ends_at = GREATEST(COALESCE(subscription_ends_at, now()), now()) + interval '1 year',
        approved_at = now(), approved_by = auth.uid(), review_note = _note, updated_at = now()
      WHERE id = _pharmacy_id;
      UPDATE public.subscription_payments SET status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now()
      WHERE pharmacy_id = _pharmacy_id AND status = 'pending';
    END IF;
    IF v_ph.owner_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_ph.owner_id, CASE WHEN v_ph.business_type = 'supplier' THEN 'supplier'::public.user_role ELSE 'pharmacy_owner'::public.user_role END)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF _decision = 'reject' THEN
    UPDATE public.pharmacies SET status = 'rejected', review_note = _note, updated_at = now() WHERE id = _pharmacy_id;
  ELSE
    RAISE EXCEPTION 'Unknown decision';
  END IF;

  INSERT INTO public.audit_logs (pharmacy_id, user_id, action, entity, entity_id, details)
  VALUES (_pharmacy_id, auth.uid(), 'registration_' || _decision, 'pharmacy', _pharmacy_id::text, jsonb_build_object('note', _note));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.review_registration(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_registration(uuid, text, text) TO authenticated;

-- Admin: confirm or reject a yearly payment (renewals after trial/expiry)
CREATE OR REPLACE FUNCTION public.review_subscription_payment(_payment_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pay public.subscription_payments%ROWTYPE;
  v_ph public.pharmacies%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = _payment_id;
  IF v_pay.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  SELECT * INTO v_ph FROM public.pharmacies WHERE id = v_pay.pharmacy_id;

  IF _decision = 'confirm' THEN
    UPDATE public.subscription_payments SET status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now(), review_note = _note
    WHERE id = _payment_id;
    UPDATE public.pharmacies SET status = 'active', billing_choice = 'annual',
      plan_id = COALESCE(v_pay.plan_id, plan_id),
      subscription_ends_at = GREATEST(COALESCE(subscription_ends_at, now()), now()) + make_interval(months => v_pay.period_months),
      approved_at = COALESCE(approved_at, now()), approved_by = COALESCE(approved_by, auth.uid()), updated_at = now()
    WHERE id = v_pay.pharmacy_id;
    IF v_ph.owner_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_ph.owner_id, CASE WHEN v_ph.business_type = 'supplier' THEN 'supplier'::public.user_role ELSE 'pharmacy_owner'::public.user_role END)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF _decision = 'reject' THEN
    UPDATE public.subscription_payments SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = _note
    WHERE id = _payment_id;
  ELSE
    RAISE EXCEPTION 'Unknown decision';
  END IF;

  INSERT INTO public.audit_logs (pharmacy_id, user_id, action, entity, entity_id, details)
  VALUES (v_pay.pharmacy_id, auth.uid(), 'payment_' || _decision, 'subscription_payment', _payment_id::text, jsonb_build_object('note', _note));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.review_subscription_payment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_subscription_payment(uuid, text, text) TO authenticated;

-- Admin: extend a free trial
CREATE OR REPLACE FUNCTION public.extend_trial(_pharmacy_id uuid, _days integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF _days IS NULL OR _days < 1 OR _days > 365 THEN RAISE EXCEPTION 'Days must be between 1 and 365'; END IF;
  UPDATE public.pharmacies SET status = 'trial',
    trial_ends_at = GREATEST(COALESCE(trial_ends_at, now()), now()) + make_interval(days => _days), updated_at = now()
  WHERE id = _pharmacy_id;
  INSERT INTO public.audit_logs (pharmacy_id, user_id, action, entity, entity_id, details)
  VALUES (_pharmacy_id, auth.uid(), 'trial_extended', 'pharmacy', _pharmacy_id::text, jsonb_build_object('days', _days));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.extend_trial(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extend_trial(uuid, integer) TO authenticated;

-- Signup trigger: profile, first-account admin, optional registration from the signup form.
-- Provider roles (pharmacy_owner / supplier) are granted only when an administrator approves.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.email, ''),
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
          NULLIF(NEW.raw_user_meta_data->'registration'->>'phone',''))
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  END IF;

  IF jsonb_typeof(NEW.raw_user_meta_data->'registration') = 'object' THEN
    BEGIN
      PERFORM public.create_registration(NEW.id, NEW.raw_user_meta_data->'registration');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Registration from signup could not be saved: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Private bucket policies for payment receipts (files live under <user id>/...)
CREATE POLICY "Owners upload own receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners and admins read receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_platform_admin()));
