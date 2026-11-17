CREATE OR REPLACE FUNCTION public.plan_yearly_price(_plan_id uuid)
 RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(NULLIF(price_tzs_annual, 0), price_tzs_monthly * 12, 0) FROM public.subscription_plans WHERE id = _plan_id
$$;
COMMENT ON COLUMN public.subscription_plans.price_tzs_annual IS 'Exact yearly price (full year total), not a monthly rate';

CREATE OR REPLACE FUNCTION public.create_registration(_user_id uuid, _payload jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  -- Every plan offers the free 30-day trial.
  IF v_billing NOT IN ('trial','annual') THEN v_billing := 'trial'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = _user_id;
  SELECT * INTO v_existing FROM public.pharmacies WHERE owner_id = _user_id ORDER BY created_at DESC LIMIT 1;
  IF v_existing.id IS NOT NULL AND v_existing.status::text <> 'rejected' THEN
    RAISE EXCEPTION 'This account already has a registration';
  END IF;
  IF v_existing.id IS NOT NULL THEN
    UPDATE public.pharmacies SET
      name = trim(_payload->>'business_name'), business_type = v_type, plan_id = v_plan.id, billing_choice = v_billing,
      phone = NULLIF(_payload->>'phone',''), city = COALESCE(NULLIF(_payload->>'city',''), 'Dar es Salaam'),
      address = NULLIF(_payload->>'address',''), registration_number = NULLIF(_payload->>'registration_number',''),
      tax_number = NULLIF(_payload->>'tax_number',''), owner_name = NULLIF(_payload->>'owner_name',''),
      status = 'pending', review_note = NULL, updated_at = now()
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
            COALESCE(NULLIF(_payload->>'payment_method',''), 'mobile_money'), trim(_payload->>'payment_reference'), _user_id);
  END IF;
  INSERT INTO public.audit_logs (pharmacy_id, user_id, action, entity, entity_id, details)
  VALUES (v_id, _user_id, 'registration_submitted', 'pharmacy', v_id::text,
          jsonb_build_object('plan', v_plan.slug, 'billing', v_billing, 'type', v_type));
  RETURN v_id;
END;
$function$;