CREATE TABLE public.business_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  doc_number text NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  customer jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_info text,
  delivery_info text,
  notes text,
  source_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pharmacy_id, doc_number)
);
CREATE INDEX business_documents_pharmacy ON public.business_documents(pharmacy_id, created_at DESC);
GRANT SELECT ON public.business_documents TO authenticated;
GRANT ALL ON public.business_documents TO service_role;
ALTER TABLE public.business_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read documents" ON public.business_documents FOR SELECT TO authenticated USING (public.user_belongs_to_pharmacy(pharmacy_id));

CREATE TABLE public.business_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.business_documents(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_document_events TO authenticated;
GRANT ALL ON public.business_document_events TO service_role;
ALTER TABLE public.business_document_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events follow document" ON public.business_document_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.business_documents d WHERE d.id = document_id));

CREATE OR REPLACE FUNCTION public.create_business_document(_pharmacy uuid, _type text, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prefix text; n int; items jsonb := '[]'::jsonb; it jsonb; sub numeric := 0; disc numeric; rate numeric; tx numeric; new_id uuid; sale_id uuid; q numeric; p numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT public.can_write_pharmacy(_pharmacy, ARRAY['manager','pharmacist','cashier','accountant','inventory_manager']::public.user_role[]) THEN RAISE EXCEPTION 'Not allowed to create documents for this business'; END IF;
  prefix := CASE _type WHEN 'invoice' THEN 'INV' WHEN 'proforma' THEN 'PRO' WHEN 'delivery_note' THEN 'DN' WHEN 'label' THEN 'LBL' ELSE NULL END;
  IF prefix IS NULL THEN RAISE EXCEPTION 'Unknown document type'; END IF;
  sale_id := public.try_uuid(_payload->>'source_sale_id');
  IF sale_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.pharmacy_id = _pharmacy) THEN RAISE EXCEPTION 'Sale not found'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', pr.name, 'description', concat_ws(' ', pr.strength, pr.dosage_form), 'quantity', si.quantity, 'unit_price', si.unit_price, 'barcode', pr.barcode, 'batch', b.batch_number, 'expiry', b.expiry_date)), '[]')
      INTO _payload FROM public.sale_items si JOIN public.products pr ON pr.id = si.product_id LEFT JOIN public.inventory_batches b ON b.id = si.batch_id WHERE si.sale_id = sale_id;
    _payload := jsonb_build_object('items', _payload, 'discount', (SELECT COALESCE(discount,0) FROM public.sales WHERE id = sale_id), 'payment_info', (SELECT 'Paid by ' || COALESCE(payment_method,'cash') || ' · ' || invoice_number FROM public.sales WHERE id = sale_id), 'source_sale_id', sale_id);
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'items','[]')) LOOP
    q := COALESCE((it->>'quantity')::numeric, 0); p := COALESCE((it->>'unit_price')::numeric, 0);
    IF q <= 0 OR p < 0 OR COALESCE(trim(it->>'name'),'') = '' THEN RAISE EXCEPTION 'Each line needs a name, quantity above 0 and a price'; END IF;
    items := items || jsonb_build_object('name', it->>'name', 'description', it->>'description', 'quantity', q, 'unit_price', p, 'total', round(q*p, 2), 'barcode', it->>'barcode', 'batch', it->>'batch', 'expiry', it->>'expiry');
    sub := sub + round(q*p, 2);
  END LOOP;
  IF jsonb_array_length(items) = 0 THEN RAISE EXCEPTION 'Add at least one line'; END IF;
  disc := LEAST(GREATEST(COALESCE((_payload->>'discount')::numeric, 0), 0), sub);
  rate := LEAST(GREATEST(COALESCE((_payload->>'tax_rate')::numeric, 0), 0), 100);
  tx := round((sub - disc) * rate / 100, 2);
  PERFORM pg_advisory_xact_lock(hashtext(_pharmacy::text || prefix));
  SELECT COALESCE(MAX(NULLIF(regexp_replace(doc_number, '\D', '', 'g'), '')::int), 0) + 1 INTO n FROM public.business_documents WHERE pharmacy_id = _pharmacy AND doc_type = _type;
  INSERT INTO public.business_documents(pharmacy_id, doc_type, doc_number, status, customer, items, subtotal, discount, tax_rate, tax, total, payment_info, delivery_info, notes, source_sale_id, created_by)
  VALUES (_pharmacy, _type, prefix || '-' || lpad(n::text, 6, '0'),
    CASE WHEN _type = 'invoice' AND sale_id IS NOT NULL THEN 'paid' WHEN _type = 'proforma' THEN 'draft' ELSE 'issued' END,
    COALESCE(_payload->'customer', '{}'::jsonb), items, sub, disc, rate, tx, sub - disc + tx,
    _payload->>'payment_info', _payload->>'delivery_info', _payload->>'notes', sale_id, auth.uid())
  RETURNING id INTO new_id;
  INSERT INTO public.business_document_events(document_id, actor_id, action) VALUES (new_id, auth.uid(), 'created');
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_document_status(_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.business_documents;
BEGIN
  SELECT * INTO d FROM public.business_documents WHERE id = _id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Document not found'; END IF;
  IF NOT public.can_write_pharmacy(d.pharmacy_id, ARRAY['manager','pharmacist','cashier','accountant','inventory_manager']::public.user_role[]) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _status NOT IN ('draft','issued','sent','paid','delivered','cancelled') THEN RAISE EXCEPTION 'Unknown status'; END IF;
  UPDATE public.business_documents SET status = _status, updated_at = now() WHERE id = _id;
  INSERT INTO public.business_document_events(document_id, actor_id, action, note) VALUES (_id, auth.uid(), 'status:' || _status, _note);
END $$;

REVOKE ALL ON FUNCTION public.create_business_document(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_document_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business_document(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_document_status(uuid, text, text) TO authenticated;