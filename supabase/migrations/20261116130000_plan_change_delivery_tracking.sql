-- Swahivo: admin plan change + delivery tracking (tracking numbers, rider stages, live location, signed proof)

-- 1. Admin changes a business's subscription plan (dates stay as they are).
CREATE OR REPLACE FUNCTION public.admin_change_plan(_pharmacy_id uuid, _plan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = _plan_id AND COALESCE(is_active, true)) THEN RAISE EXCEPTION 'Plan not found'; END IF;
  SELECT plan_id INTO v_old FROM public.pharmacies WHERE id = _pharmacy_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business not found'; END IF;
  UPDATE public.pharmacies SET plan_id = _plan_id, updated_at = now() WHERE id = _pharmacy_id;
  INSERT INTO public.audit_logs(pharmacy_id, user_id, action, entity, entity_id, details)
  VALUES (_pharmacy_id, auth.uid(), 'plan_changed', 'pharmacies', _pharmacy_id::text, jsonb_build_object('from', v_old, 'to', _plan_id));
END $$;
REVOKE ALL ON FUNCTION public.admin_change_plan(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_change_plan(uuid, uuid) TO authenticated;

-- 2. Delivery jobs
CREATE TABLE IF NOT EXISTS public.delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number text NOT NULL UNIQUE,
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  buyer_pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  wholesale_order_id uuid REFERENCES public.wholesale_orders(id) ON DELETE SET NULL,
  rider_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','picked_up','in_transit','arrived','delivered','cancelled')),
  pickup_address text,
  dropoff_address text NOT NULL,
  recipient_name text,
  recipient_phone text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  rider_lat double precision,
  rider_lng double precision,
  rider_seen_at timestamptz,
  signature text,
  signed_name text,
  delivered_at timestamptz,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_jobs TO authenticated;
GRANT ALL ON public.delivery_jobs TO service_role;
ALTER TABLE public.delivery_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.delivery_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.delivery_jobs(id) ON DELETE CASCADE,
  status text NOT NULL,
  actor_id uuid,
  lat double precision,
  lng double precision,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_job_events TO authenticated;
GRANT ALL ON public.delivery_job_events TO service_role;
ALTER TABLE public.delivery_job_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_delivery(_job uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.delivery_jobs j WHERE j.id = _job AND (
    public.is_platform_admin() OR j.rider_id = auth.uid()
    OR public.user_belongs_to_pharmacy(j.pharmacy_id)
    OR (j.buyer_pharmacy_id IS NOT NULL AND public.user_belongs_to_pharmacy(j.buyer_pharmacy_id))))
$$;

DROP POLICY IF EXISTS "delivery jobs visible to parties" ON public.delivery_jobs;
CREATE POLICY "delivery jobs visible to parties" ON public.delivery_jobs FOR SELECT TO authenticated USING (
  public.is_platform_admin() OR rider_id = auth.uid() OR public.user_belongs_to_pharmacy(pharmacy_id)
  OR (buyer_pharmacy_id IS NOT NULL AND public.user_belongs_to_pharmacy(buyer_pharmacy_id)));
DROP POLICY IF EXISTS "delivery events visible to parties" ON public.delivery_job_events;
CREATE POLICY "delivery events visible to parties" ON public.delivery_job_events FOR SELECT TO authenticated USING (public.can_see_delivery(job_id));

CREATE OR REPLACE FUNCTION public.create_delivery_job(_pharmacy uuid, _order uuid, _dropoff text, _recipient text, _phone text, _lat double precision, _lng double precision, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_trk text; v_buyer uuid; v_pickup text;
BEGIN
  IF NOT public.can_write_pharmacy(_pharmacy, ARRAY['manager','pharmacist','cashier','inventory_manager']::user_role[]) AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'You cannot create deliveries for this business'; END IF;
  IF COALESCE(trim(_dropoff), '') = '' THEN RAISE EXCEPTION 'Delivery address is required'; END IF;
  IF _order IS NOT NULL THEN
    SELECT buyer_pharmacy_id INTO v_buyer FROM public.wholesale_orders WHERE id = _order AND supplier_id = _pharmacy;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found for this supplier'; END IF;
    IF EXISTS (SELECT 1 FROM public.delivery_jobs WHERE wholesale_order_id = _order AND status <> 'cancelled') THEN RAISE EXCEPTION 'This order already has a delivery'; END IF;
  END IF;
  SELECT concat_ws(', ', address, city) INTO v_pickup FROM public.pharmacies WHERE id = _pharmacy;
  LOOP
    v_trk := 'TRK-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.delivery_jobs WHERE tracking_number = v_trk);
  END LOOP;
  INSERT INTO public.delivery_jobs(tracking_number, pharmacy_id, buyer_pharmacy_id, wholesale_order_id, pickup_address, dropoff_address, recipient_name, recipient_phone, dropoff_lat, dropoff_lng, note, created_by)
  VALUES (v_trk, _pharmacy, v_buyer, _order, v_pickup, trim(_dropoff), nullif(trim(_recipient), ''), nullif(trim(_phone), ''), _lat, _lng, nullif(trim(_note), ''), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.delivery_job_events(job_id, status, actor_id, note) VALUES (v_id, 'pending', auth.uid(), 'Tracking number ' || v_trk || ' created');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.advance_delivery_job(_job uuid, _status text, _lat double precision, _lng double precision, _note text, _signature text, _signed_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.delivery_jobs%ROWTYPE; v_rider boolean; v_staff boolean;
BEGIN
  SELECT * INTO j FROM public.delivery_jobs WHERE id = _job FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found'; END IF;
  IF j.status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'This delivery is already closed'; END IF;
  v_rider := public.has_pharmacy_role(j.pharmacy_id, ARRAY['delivery_rider']::user_role[]) OR public.is_pharmacy_owner(j.pharmacy_id);
  v_staff := public.can_write_pharmacy(j.pharmacy_id, ARRAY['manager']::user_role[]) OR public.is_platform_admin();
  IF _status = 'accepted' THEN
    IF j.status <> 'pending' OR NOT v_rider THEN RAISE EXCEPTION 'Only a rider of this business can accept a waiting delivery'; END IF;
    UPDATE public.delivery_jobs SET rider_id = auth.uid(), status = 'accepted', updated_at = now() WHERE id = _job;
  ELSIF _status = 'cancelled' THEN
    IF NOT v_staff THEN RAISE EXCEPTION 'Only a manager can cancel a delivery'; END IF;
    UPDATE public.delivery_jobs SET status = 'cancelled', updated_at = now() WHERE id = _job;
  ELSIF _status IN ('picked_up','in_transit','arrived','delivered') THEN
    IF j.rider_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the assigned rider can update this delivery'; END IF;
    IF array_position(ARRAY['accepted','picked_up','in_transit','arrived','delivered'], _status) <= array_position(ARRAY['accepted','picked_up','in_transit','arrived','delivered'], j.status) THEN
      RAISE EXCEPTION 'Delivery stages must move forward'; END IF;
    IF _status = 'delivered' AND (COALESCE(_signature, '') NOT LIKE 'data:image/png;base64,%' OR COALESCE(trim(_signed_name), '') = '' OR length(_signature) > 400000) THEN
      RAISE EXCEPTION 'The receiver must sign and give their name'; END IF;
    UPDATE public.delivery_jobs SET status = _status, updated_at = now(),
      rider_lat = COALESCE(_lat, rider_lat), rider_lng = COALESCE(_lng, rider_lng), rider_seen_at = CASE WHEN _lat IS NULL THEN rider_seen_at ELSE now() END,
      signature = CASE WHEN _status = 'delivered' THEN _signature ELSE signature END,
      signed_name = CASE WHEN _status = 'delivered' THEN trim(_signed_name) ELSE signed_name END,
      delivered_at = CASE WHEN _status = 'delivered' THEN now() ELSE delivered_at END
    WHERE id = _job;
  ELSE RAISE EXCEPTION 'Unknown delivery stage'; END IF;
  INSERT INTO public.delivery_job_events(job_id, status, actor_id, lat, lng, note) VALUES (_job, _status, auth.uid(), _lat, _lng, nullif(trim(_note), ''));
END $$;

CREATE OR REPLACE FUNCTION public.ping_delivery_location(_job uuid, _lat double precision, _lng double precision)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.delivery_jobs SET rider_lat = _lat, rider_lng = _lng, rider_seen_at = now()
  WHERE id = _job AND rider_id = auth.uid() AND status IN ('accepted','picked_up','in_transit','arrived');
END $$;

REVOKE ALL ON FUNCTION public.create_delivery_job(uuid, uuid, text, text, text, double precision, double precision, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.advance_delivery_job(uuid, text, double precision, double precision, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.ping_delivery_location(uuid, double precision, double precision) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_delivery_job(uuid, uuid, text, text, text, double precision, double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_delivery_job(uuid, text, double precision, double precision, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ping_delivery_location(uuid, double precision, double precision) TO authenticated;
