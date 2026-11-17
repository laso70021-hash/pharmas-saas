-- Monthly or yearly paid cycles, explicit start dates, admin date control and plan AI token quotas.
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS subscription_starts_at timestamptz;
ALTER TABLE public.pharmacies DROP CONSTRAINT IF EXISTS pharmacies_billing_choice_check;
ALTER TABLE public.pharmacies ADD CONSTRAINT pharmacies_billing_choice_check CHECK (billing_choice IN ('trial','monthly','annual'));
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS ai_tokens_monthly integer;
UPDATE public.subscription_plans SET ai_tokens_monthly = CASE slug
  WHEN 'starter' THEN 25000 WHEN 'growth' THEN 100000 WHEN 'professional' THEN 300000 WHEN 'network' THEN 750000 ELSE NULL END;

CREATE OR REPLACE FUNCTION public.submit_subscription_payment(_pharmacy_id uuid, _plan_slug text, _method text, _reference text, _receipt_path text, _period_months integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan public.subscription_plans%ROWTYPE; v_id uuid; v_amount numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pharmacies WHERE id = _pharmacy_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'You can only pay for your own business'; END IF;
  IF _period_months NOT IN (1, 12) THEN RAISE EXCEPTION 'Choose monthly or yearly'; END IF;
  IF COALESCE(trim(_reference),'') = '' AND COALESCE(trim(_receipt_path),'') = '' THEN
    RAISE EXCEPTION 'Add a payment reference or upload a receipt'; END IF;
  IF COALESCE(_receipt_path,'') <> '' AND split_part(_receipt_path, '/', 1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'Invalid receipt'; END IF;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE slug = _plan_slug;
  IF v_plan.id IS NULL THEN SELECT s.* INTO v_plan FROM public.subscription_plans s JOIN public.pharmacies p ON p.plan_id = s.id WHERE p.id = _pharmacy_id; END IF;
  v_amount := CASE WHEN _period_months = 1 THEN v_plan.price_tzs_monthly ELSE public.plan_yearly_price(v_plan.id) END;
  INSERT INTO public.subscription_payments (pharmacy_id, plan_id, amount_tzs, period_months, method, reference, receipt_path, submitted_by)
  VALUES (_pharmacy_id, v_plan.id, v_amount, _period_months, COALESCE(NULLIF(_method,''),'mobile_money'), NULLIF(trim(_reference),''), NULLIF(_receipt_path,''), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.audit_logs (pharmacy_id, user_id, action, entity, entity_id, details)
  VALUES (_pharmacy_id, auth.uid(), 'payment_submitted', 'subscription_payment', v_id::text, jsonb_build_object('period_months', _period_months));
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_subscription_payment(uuid, text, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_subscription_payment(uuid, text, text, text, text, integer) TO authenticated;

-- Paying ends any trial: the paid period starts today (or after the current paid period) and replaces the trial.
CREATE OR REPLACE FUNCTION public.review_subscription_payment(_payment_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pay public.subscription_payments%ROWTYPE; v_ph public.pharmacies%ROWTYPE; v_start timestamptz;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = _payment_id;
  IF v_pay.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  SELECT * INTO v_ph FROM public.pharmacies WHERE id = v_pay.pharmacy_id;
  IF _decision = 'confirm' THEN
    v_start := CASE WHEN v_ph.status = 'active' AND v_ph.subscription_ends_at > now() THEN v_ph.subscription_ends_at ELSE now() END;
    UPDATE public.subscription_payments SET status='confirmed', reviewed_by=auth.uid(), reviewed_at=now(), review_note=_note WHERE id=_payment_id;
    UPDATE public.pharmacies SET status='active',
      billing_choice = CASE WHEN v_pay.period_months = 1 THEN 'monthly' ELSE 'annual' END,
      plan_id = COALESCE(v_pay.plan_id, plan_id),
      subscription_starts_at = CASE WHEN v_start = now() THEN now() ELSE COALESCE(subscription_starts_at, now()) END,
      subscription_ends_at = v_start + make_interval(months => v_pay.period_months),
      trial_ends_at = LEAST(COALESCE(trial_ends_at, now()), now()),
      approved_at = COALESCE(approved_at, now()), approved_by = COALESCE(approved_by, auth.uid()), updated_at = now()
    WHERE id = v_pay.pharmacy_id;
    IF v_ph.owner_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_ph.owner_id, CASE WHEN v_ph.business_type='supplier' THEN 'supplier'::public.user_role ELSE 'pharmacy_owner'::public.user_role END)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF _decision = 'reject' THEN
    UPDATE public.subscription_payments SET status='rejected', reviewed_by=auth.uid(), reviewed_at=now(), review_note=_note WHERE id=_payment_id;
  ELSE RAISE EXCEPTION 'Unknown decision'; END IF;
  INSERT INTO public.audit_logs (pharmacy_id, user_id, action, entity, entity_id, details)
  VALUES (v_pay.pharmacy_id, auth.uid(), 'payment_'||_decision, 'subscription_payment', _payment_id::text, jsonb_build_object('note', _note));
END $$;
REVOKE EXECUTE ON FUNCTION public.review_subscription_payment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_subscription_payment(uuid, text, text) TO authenticated;

-- Admin sets the exact service window (trial or paid monthly/yearly).
CREATE OR REPLACE FUNCTION public.admin_set_subscription(_pharmacy_id uuid, _cycle text, _starts_at timestamptz, _ends_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ph public.pharmacies%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF _cycle NOT IN ('trial','monthly','annual') THEN RAISE EXCEPTION 'Unknown billing cycle'; END IF;
  IF _starts_at IS NULL OR _ends_at IS NULL OR _ends_at <= _starts_at THEN RAISE EXCEPTION 'End date must be after start date'; END IF;
  SELECT * INTO v_ph FROM public.pharmacies WHERE id = _pharmacy_id;
  IF v_ph.id IS NULL THEN RAISE EXCEPTION 'Business not found'; END IF;
  IF _cycle = 'trial' THEN
    UPDATE public.pharmacies SET status='trial', billing_choice='trial', subscription_starts_at=_starts_at, trial_ends_at=_ends_at,
      approved_at=COALESCE(approved_at, now()), approved_by=COALESCE(approved_by, auth.uid()), review_note=NULL, updated_at=now() WHERE id=_pharmacy_id;
  ELSE
    UPDATE public.pharmacies SET status='active', billing_choice=_cycle, subscription_starts_at=_starts_at, subscription_ends_at=_ends_at,
      trial_ends_at=LEAST(COALESCE(trial_ends_at, _starts_at), _starts_at),
      approved_at=COALESCE(approved_at, now()), approved_by=COALESCE(approved_by, auth.uid()), review_note=NULL, updated_at=now() WHERE id=_pharmacy_id;
  END IF;
  IF v_ph.owner_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_ph.owner_id, CASE WHEN v_ph.business_type='supplier' THEN 'supplier'::public.user_role ELSE 'pharmacy_owner'::public.user_role END)
    ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.audit_logs (pharmacy_id, user_id, action, entity, entity_id, details)
  VALUES (_pharmacy_id, auth.uid(), 'subscription_set', 'pharmacy', _pharmacy_id::text,
    jsonb_build_object('cycle', _cycle, 'starts_at', _starts_at, 'ends_at', _ends_at));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_subscription(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription(uuid, text, timestamptz, timestamptz) TO authenticated;

-- Monthly AI token allowance for a business (calendar month, UTC). NULL limit = unlimited.
CREATE OR REPLACE FUNCTION public.pharmacy_ai_tokens(_pharmacy_id uuid, OUT token_limit integer, OUT tokens_used bigint)
RETURNS record LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.ai_tokens_monthly,
    COALESCE((SELECT sum(l.tokens_used) FROM public.ai_request_logs l
      WHERE l.pharmacy_id = _pharmacy_id AND l.created_at >= date_trunc('month', now())), 0)
  FROM public.pharmacies p LEFT JOIN public.subscription_plans s ON s.id = p.plan_id
  WHERE p.id = _pharmacy_id AND (public.is_platform_admin() OR public.user_belongs_to_pharmacy(_pharmacy_id));
$$;
REVOKE EXECUTE ON FUNCTION public.pharmacy_ai_tokens(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pharmacy_ai_tokens(uuid) TO authenticated;
