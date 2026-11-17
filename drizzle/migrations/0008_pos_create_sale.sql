CREATE OR REPLACE FUNCTION public.create_sale(_pharmacy uuid, _branch uuid, _items jsonb, _method text,
  _discount numeric, _reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid := gen_random_uuid(); _it jsonb; _p record; _b record; _qty int; _need int; _take int;
  _sub numeric := 0; _disc numeric := greatest(coalesce(_discount,0),0); _stock bigint;
BEGIN
  IF NOT public.can_write_pharmacy(_pharmacy, ARRAY['manager','pharmacist','cashier']::user_role[]) THEN
    RAISE EXCEPTION 'You cannot sell for this pharmacy (check your role and subscription)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM branches WHERE id=_branch AND pharmacy_id=_pharmacy AND is_active IS NOT FALSE) THEN
    RAISE EXCEPTION 'Choose an open branch'; END IF;
  IF _method NOT IN ('cash','mpesa','tigopesa','airtel','card','bank') THEN RAISE EXCEPTION 'Unknown payment method'; END IF;
  IF jsonb_array_length(coalesce(_items,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'The cart is empty'; END IF;

  INSERT INTO sales(id, pharmacy_id, branch_id, cashier_id, invoice_number, subtotal, discount, tax, total, payment_status, payment_method)
  VALUES (_id, _pharmacy, _branch, auth.uid(), 'INV-' || to_char(now(),'YYMMDD') || '-' || upper(substr(_id::text,1,5)), 0, 0, 0, 0, 'paid', _method);

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_it->>'quantity')::int;
    IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT * INTO _p FROM products WHERE id = public.try_uuid(_it->>'product_id') AND pharmacy_id=_pharmacy AND is_active IS NOT FALSE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A product is not available'; END IF;
    SELECT coalesce(sum(quantity),0) INTO _stock FROM inventory_batches WHERE product_id=_p.id AND branch_id=_branch AND quantity>0 AND expiry_date>=current_date;
    IF _qty > _stock THEN RAISE EXCEPTION 'Only % of % left in this branch', _stock, _p.name; END IF;
    _need := _qty;
    FOR _b IN SELECT * FROM inventory_batches WHERE product_id=_p.id AND branch_id=_branch AND quantity>0 AND expiry_date>=current_date
      ORDER BY expiry_date FOR UPDATE LOOP
      EXIT WHEN _need <= 0;
      _take := least(_need, _b.quantity);
      UPDATE inventory_batches SET quantity = quantity - _take, updated_at = now() WHERE id=_b.id;
      INSERT INTO sale_items(sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (_id, _p.id, _b.id, _take, _p.selling_price, _p.selling_price*_take);
      INSERT INTO stock_movements(pharmacy_id, product_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
      VALUES (_pharmacy, _p.id, _b.id, 'sale', -_take, _id, 'Sale', auth.uid());
      _need := _need - _take;
    END LOOP;
    _sub := _sub + _p.selling_price*_qty;
  END LOOP;
  _disc := least(_disc, _sub);
  UPDATE sales SET subtotal=_sub, discount=_disc, total=_sub-_disc WHERE id=_id;
  INSERT INTO sale_payments(sale_id, amount, payment_method, reference_code, paid_at)
  VALUES (_id, _sub-_disc, _method, nullif(trim(_reference),''), now());
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_sale(uuid,uuid,jsonb,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale(uuid,uuid,jsonb,text,numeric,text) TO authenticated;