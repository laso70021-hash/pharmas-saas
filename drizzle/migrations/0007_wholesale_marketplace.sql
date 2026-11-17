CREATE TABLE public.wholesale_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  buyer_pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'payment_submitted',
  total_amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL,
  payment_reference text,
  receipt_path text,
  supplier_note text,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.wholesale_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE CASCADE,
  supplier_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wholesale_orders TO authenticated;
GRANT SELECT ON public.wholesale_order_items TO authenticated;
GRANT ALL ON public.wholesale_orders TO service_role;
GRANT ALL ON public.wholesale_order_items TO service_role;
ALTER TABLE public.wholesale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer or supplier members read orders" ON public.wholesale_orders FOR SELECT TO authenticated
  USING (public.user_belongs_to_pharmacy(buyer_pharmacy_id) OR public.user_belongs_to_pharmacy(supplier_id));
CREATE POLICY "Buyer or supplier members read order items" ON public.wholesale_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wholesale_orders o WHERE o.id = order_id
    AND (public.user_belongs_to_pharmacy(o.buyer_pharmacy_id) OR public.user_belongs_to_pharmacy(o.supplier_id))));

CREATE OR REPLACE FUNCTION public.supplier_catalog()
RETURNS TABLE(product_id uuid, supplier_id uuid, supplier_name text, supplier_city text, name text, generic_name text,
  dosage_form text, strength text, unit_price numeric, image_url text, is_prescription_required boolean, stock bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, s.id, s.name, s.city, p.name, p.generic_name, p.dosage_form, p.strength, p.selling_price, p.image_url,
    COALESCE(p.is_prescription_required,false),
    COALESCE((SELECT sum(b.quantity) FROM public.inventory_batches b WHERE b.product_id = p.id AND b.quantity > 0 AND b.expiry_date >= current_date),0)
  FROM public.products p JOIN public.pharmacies s ON s.id = p.pharmacy_id
  WHERE s.business_type = 'supplier' AND public.pharmacy_is_current(s.id) AND p.is_active IS NOT FALSE
    AND auth.uid() IS NOT NULL
  ORDER BY s.name, p.name
$$;

CREATE OR REPLACE FUNCTION public.place_wholesale_order(_buyer uuid, _supplier uuid, _branch uuid, _items jsonb,
  _method text, _reference text, _receipt_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid := gen_random_uuid(); _it jsonb; _p record; _qty int; _stock bigint; _total numeric := 0;
BEGIN
  IF NOT public.can_write_pharmacy(_buyer, ARRAY['manager','inventory_manager']::user_role[]) THEN
    RAISE EXCEPTION 'You cannot place orders for this pharmacy (check your role and subscription)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pharmacies WHERE id = _buyer AND business_type = 'pharmacy') THEN
    RAISE EXCEPTION 'Only pharmacies can order from suppliers'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pharmacies WHERE id = _supplier AND business_type = 'supplier') OR NOT public.pharmacy_is_current(_supplier) THEN
    RAISE EXCEPTION 'This supplier is not available'; END IF;
  IF NOT EXISTS (SELECT 1 FROM branches WHERE id = _branch AND pharmacy_id = _buyer) THEN
    RAISE EXCEPTION 'Choose one of your branches to receive the stock'; END IF;
  IF coalesce(trim(_reference),'') = '' AND coalesce(_receipt_path,'') = '' THEN
    RAISE EXCEPTION 'Add the payment reference or attach the receipt'; END IF;
  IF _receipt_path IS NOT NULL AND split_part(_receipt_path,'/',1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'Invalid receipt'; END IF;
  IF jsonb_array_length(coalesce(_items,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'The order is empty'; END IF;

  INSERT INTO wholesale_orders(id, order_number, buyer_pharmacy_id, supplier_id, branch_id, payment_method, payment_reference, receipt_path, created_by)
  VALUES (_id, 'WO-' || to_char(now(),'YYMMDD') || '-' || upper(substr(_id::text,1,5)), _buyer, _supplier, _branch, _method, nullif(trim(_reference),''), _receipt_path, auth.uid());

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_it->>'quantity')::int;
    IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT * INTO _p FROM products WHERE id = public.try_uuid(_it->>'product_id') AND pharmacy_id = _supplier AND is_active IS NOT FALSE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A product is no longer available'; END IF;
    SELECT coalesce(sum(quantity),0) INTO _stock FROM inventory_batches WHERE product_id = _p.id AND quantity > 0 AND expiry_date >= current_date;
    IF _qty > _stock THEN RAISE EXCEPTION 'Only % of % in stock', _stock, _p.name; END IF;
    INSERT INTO wholesale_order_items(order_id, supplier_product_id, product_name, quantity, unit_price, total_price)
    VALUES (_id, _p.id, _p.name || coalesce(' ' || nullif(_p.strength,''),''), _qty, _p.selling_price, _p.selling_price * _qty);
    _total := _total + _p.selling_price * _qty;
  END LOOP;
  UPDATE wholesale_orders SET total_amount = _total WHERE id = _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.review_wholesale_order(_order uuid, _decision text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record; _it record; _sp record; _b record; _need int; _take int; _bp uuid;
BEGIN
  SELECT * INTO _o FROM wholesale_orders WHERE id = _order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT public.can_write_pharmacy(_o.supplier_id, ARRAY['manager','inventory_manager']::user_role[]) THEN
    RAISE EXCEPTION 'Only the supplier can review this order'; END IF;
  IF _o.status <> 'payment_submitted' THEN RAISE EXCEPTION 'This order was already reviewed'; END IF;

  IF _decision = 'reject' THEN
    UPDATE wholesale_orders SET status='rejected', supplier_note=_note, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_order;
    RETURN;
  ELSIF _decision <> 'accept' THEN RAISE EXCEPTION 'Unknown decision'; END IF;

  FOR _it IN SELECT * FROM wholesale_order_items WHERE order_id = _order LOOP
    SELECT * INTO _sp FROM products WHERE id = _it.supplier_product_id;
    IF NOT FOUND THEN RAISE EXCEPTION '% is no longer in your catalog', _it.product_name; END IF;
    -- find or create the matching product in the buyer's catalog
    SELECT id INTO _bp FROM products WHERE pharmacy_id = _o.buyer_pharmacy_id
      AND lower(name) = lower(_sp.name) AND coalesce(lower(strength),'') = coalesce(lower(_sp.strength),'') LIMIT 1;
    IF _bp IS NULL THEN
      INSERT INTO products(pharmacy_id, name, generic_name, dosage_form, strength, cost_price, selling_price, is_prescription_required, image_url, is_active)
      VALUES (_o.buyer_pharmacy_id, _sp.name, _sp.generic_name, _sp.dosage_form, _sp.strength, _it.unit_price,
        round(_it.unit_price * 1.3), _sp.is_prescription_required, _sp.image_url, true)
      RETURNING id INTO _bp;
    ELSE
      UPDATE products SET cost_price = _it.unit_price, image_url = coalesce(image_url, _sp.image_url) WHERE id = _bp;
    END IF;
    _need := _it.quantity;
    FOR _b IN SELECT * FROM inventory_batches WHERE product_id = _sp.id AND quantity > 0 AND expiry_date >= current_date
      ORDER BY expiry_date FOR UPDATE LOOP
      EXIT WHEN _need <= 0;
      _take := least(_need, _b.quantity);
      UPDATE inventory_batches SET quantity = quantity - _take, updated_at = now() WHERE id = _b.id;
      INSERT INTO stock_movements(pharmacy_id, product_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
      VALUES (_o.supplier_id, _sp.id, _b.id, 'wholesale_out', -_take, _order, 'Order ' || _o.order_number, auth.uid());
      WITH nb AS (
        INSERT INTO inventory_batches(pharmacy_id, branch_id, product_id, batch_number, quantity, cost_per_unit, expiry_date, received_date)
        VALUES (_o.buyer_pharmacy_id, _o.branch_id, _bp, _b.batch_number, _take, _it.unit_price, _b.expiry_date, current_date) RETURNING id)
      INSERT INTO stock_movements(pharmacy_id, product_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
      SELECT _o.buyer_pharmacy_id, _bp, nb.id, 'stock_in', _take, _order, 'Supplier order ' || _o.order_number, auth.uid() FROM nb;
      _need := _need - _take;
    END LOOP;
    IF _need > 0 THEN RAISE EXCEPTION 'Not enough stock of % to fill this order', _it.product_name; END IF;
  END LOOP;
  UPDATE wholesale_orders SET status='completed', supplier_note=_note, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_order;
END $$;

REVOKE EXECUTE ON FUNCTION public.supplier_catalog() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.place_wholesale_order(uuid,uuid,uuid,jsonb,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_wholesale_order(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_wholesale_order(uuid,uuid,uuid,jsonb,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_wholesale_order(uuid,text,text) TO authenticated;

CREATE POLICY "Signed-in users view supplier product photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND EXISTS (SELECT 1 FROM public.pharmacies s
    WHERE s.id = public.try_uuid(split_part(name,'/',1)) AND s.business_type = 'supplier'));
CREATE POLICY "Suppliers view wholesale order receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND EXISTS (SELECT 1 FROM public.wholesale_orders o
    WHERE o.receipt_path = name AND public.user_belongs_to_pharmacy(o.supplier_id)));