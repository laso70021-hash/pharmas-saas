ALTER TABLE public.wholesale_orders
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_note text;

CREATE OR REPLACE FUNCTION public.set_wholesale_order_delivery(_order uuid, _contact_name text, _contact_phone text, _address text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record;
BEGIN
  SELECT * INTO _o FROM wholesale_orders WHERE id = _order;
  IF NOT FOUND OR NOT public.user_belongs_to_pharmacy(_o.buyer_pharmacy_id) THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _o.status <> 'payment_submitted' THEN RAISE EXCEPTION 'This order was already reviewed'; END IF;
  IF coalesce(trim(_contact_phone),'') = '' OR coalesce(trim(_address),'') = '' THEN RAISE EXCEPTION 'Add a contact phone and delivery address'; END IF;
  UPDATE wholesale_orders SET contact_name = left(trim(_contact_name),120), contact_phone = left(trim(_contact_phone),40),
    delivery_address = left(trim(_address),300), delivery_note = left(nullif(trim(_note),''),500) WHERE id = _order;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_wholesale_order_delivery(uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_wholesale_order_delivery(uuid,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.supplier_directory()
RETURNS TABLE(id uuid, name text, city text, phone text, email text, address text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.city, s.phone, s.email, s.address FROM pharmacies s
  WHERE s.business_type = 'supplier' AND public.pharmacy_is_current(s.id) AND auth.uid() IS NOT NULL ORDER BY s.name
$$;
REVOKE EXECUTE ON FUNCTION public.supplier_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_directory() TO authenticated;

CREATE TABLE public.wholesale_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  sender_side text NOT NULL CHECK (sender_side IN ('buyer','supplier')),
  sender_name text,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wholesale_messages_thread_idx ON public.wholesale_messages(buyer_pharmacy_id, supplier_id, created_at);
GRANT SELECT, INSERT ON public.wholesale_messages TO authenticated;
GRANT ALL ON public.wholesale_messages TO service_role;
ALTER TABLE public.wholesale_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thread members read messages" ON public.wholesale_messages FOR SELECT TO authenticated
  USING (public.user_belongs_to_pharmacy(buyer_pharmacy_id) OR public.user_belongs_to_pharmacy(supplier_id));
CREATE POLICY "Thread members send messages" ON public.wholesale_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND (
    (sender_side = 'buyer' AND public.user_belongs_to_pharmacy(buyer_pharmacy_id)
      AND EXISTS (SELECT 1 FROM public.pharmacies s WHERE s.id = supplier_id AND s.business_type = 'supplier'))
    OR (sender_side = 'supplier' AND public.user_belongs_to_pharmacy(supplier_id)
      AND EXISTS (SELECT 1 FROM public.wholesale_orders o WHERE o.buyer_pharmacy_id = wholesale_messages.buyer_pharmacy_id AND o.supplier_id = wholesale_messages.supplier_id)
      OR sender_side = 'supplier' AND public.user_belongs_to_pharmacy(supplier_id)
      AND EXISTS (SELECT 1 FROM public.wholesale_messages m WHERE m.buyer_pharmacy_id = wholesale_messages.buyer_pharmacy_id AND m.supplier_id = wholesale_messages.supplier_id))));
ALTER PUBLICATION supabase_realtime ADD TABLE public.wholesale_messages;