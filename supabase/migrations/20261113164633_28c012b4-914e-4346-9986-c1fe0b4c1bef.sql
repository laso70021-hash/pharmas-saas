CREATE OR REPLACE FUNCTION public.request_wholesale_quote(_buyer uuid, _supplier uuid, _branch uuid, _items jsonb, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _id uuid := gen_random_uuid(); _it jsonb; _p record; _qty int; _total numeric := 0;
BEGIN
  IF NOT public.can_write_pharmacy(_buyer, ARRAY['manager','inventory_manager']::user_role[]) THEN
    RAISE EXCEPTION 'You cannot request quotes for this pharmacy'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pharmacies WHERE id = _buyer AND business_type = 'pharmacy') THEN
    RAISE EXCEPTION 'Only pharmacies can request quotes'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pharmacies WHERE id = _supplier AND business_type = 'supplier') OR NOT public.pharmacy_is_current(_supplier) THEN
    RAISE EXCEPTION 'This supplier is not available'; END IF;
  IF NOT EXISTS (SELECT 1 FROM branches WHERE id = _branch AND pharmacy_id = _buyer) THEN
    RAISE EXCEPTION 'Choose one of your branches to receive the stock'; END IF;
  IF jsonb_array_length(coalesce(_items,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'The request is empty'; END IF;
  INSERT INTO wholesale_orders(id, order_number, buyer_pharmacy_id, supplier_id, branch_id, status, payment_method, delivery_note, created_by)
  VALUES (_id, 'QR-' || to_char(now(),'YYMMDD') || '-' || upper(substr(_id::text,1,5)), _buyer, _supplier, _branch, 'quote_requested', 'pending', nullif(trim(_note),''), auth.uid());
  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_it->>'quantity')::int;
    IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT * INTO _p FROM products WHERE id = public.try_uuid(_it->>'product_id') AND pharmacy_id = _supplier AND is_active IS NOT FALSE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A product is no longer available'; END IF;
    INSERT INTO wholesale_order_items(order_id, supplier_product_id, product_name, quantity, unit_price, total_price)
    VALUES (_id, _p.id, _p.name || coalesce(' ' || nullif(_p.strength,''),''), _qty, _p.selling_price, _p.selling_price * _qty);
    _total := _total + _p.selling_price * _qty;
  END LOOP;
  UPDATE wholesale_orders SET total_amount = _total WHERE id = _id;
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.send_wholesale_quote(_order uuid, _prices jsonb, _note text, _decline boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _o record; _it record; _price numeric;
BEGIN
  SELECT * INTO _o FROM wholesale_orders WHERE id = _order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT public.can_write_pharmacy(_o.supplier_id, ARRAY['manager','inventory_manager']::user_role[]) THEN
    RAISE EXCEPTION 'Only the supplier can answer this request'; END IF;
  IF _o.status NOT IN ('quote_requested','quoted') THEN RAISE EXCEPTION 'This request is no longer open'; END IF;
  IF _decline THEN
    UPDATE wholesale_orders SET status='rejected', supplier_note=_note, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_order; RETURN;
  END IF;
  FOR _it IN SELECT * FROM wholesale_order_items WHERE order_id = _order LOOP
    _price := coalesce((SELECT (e->>'unit_price')::numeric FROM jsonb_array_elements(coalesce(_prices,'[]')) e WHERE e->>'item_id' = _it.id::text LIMIT 1), _it.unit_price);
    IF _price < 0 THEN RAISE EXCEPTION 'Price cannot be negative'; END IF;
    UPDATE wholesale_order_items SET unit_price = _price, total_price = _price * quantity WHERE id = _it.id;
  END LOOP;
  UPDATE wholesale_orders SET status='quoted', supplier_note=_note, reviewed_by=auth.uid(), reviewed_at=now(),
    total_amount = (SELECT coalesce(sum(total_price),0) FROM wholesale_order_items WHERE order_id=_order) WHERE id=_order;
END $function$;

CREATE OR REPLACE FUNCTION public.respond_wholesale_quote(_order uuid, _accept boolean, _method text, _reference text, _receipt_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _o record;
BEGIN
  SELECT * INTO _o FROM wholesale_orders WHERE id = _order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF NOT public.can_write_pharmacy(_o.buyer_pharmacy_id, ARRAY['manager','inventory_manager']::user_role[]) THEN
    RAISE EXCEPTION 'Only the requesting pharmacy can answer this quote'; END IF;
  IF NOT _accept THEN
    IF _o.status NOT IN ('quote_requested','quoted') THEN RAISE EXCEPTION 'This quote is no longer open'; END IF;
    PERFORM set_config('app.order_note', 'Declined by pharmacy', true);
    UPDATE wholesale_orders SET status='cancelled' WHERE id=_order; RETURN;
  END IF;
  IF _o.status <> 'quoted' THEN RAISE EXCEPTION 'Wait for the supplier to send prices'; END IF;
  IF coalesce(trim(_reference),'') = '' AND coalesce(_receipt_path,'') = '' THEN
    RAISE EXCEPTION 'Add the payment reference or attach the receipt'; END IF;
  IF _receipt_path IS NOT NULL AND split_part(_receipt_path,'/',1) <> auth.uid()::text THEN RAISE EXCEPTION 'Invalid receipt'; END IF;
  UPDATE wholesale_orders SET status='payment_submitted', payment_method=_method, payment_reference=nullif(trim(_reference),''), receipt_path=_receipt_path WHERE id=_order;
END $function$;

REVOKE ALL ON FUNCTION public.request_wholesale_quote(uuid,uuid,uuid,jsonb,text), public.send_wholesale_quote(uuid,jsonb,text,boolean), public.respond_wholesale_quote(uuid,boolean,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_wholesale_quote(uuid,uuid,uuid,jsonb,text), public.send_wholesale_quote(uuid,jsonb,text,boolean), public.respond_wholesale_quote(uuid,boolean,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_notify_wholesale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _sup uuid; _buy uuid; _bname text; _sname text; _note text;
BEGIN
  SELECT owner_id, name INTO _sup, _sname FROM pharmacies WHERE id = NEW.supplier_id;
  SELECT owner_id, name INTO _buy, _bname FROM pharmacies WHERE id = NEW.buyer_pharmacy_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO wholesale_order_events(order_id, status, actor_id) VALUES (NEW.id, NEW.status, auth.uid());
    PERFORM notify_user(_sup, NEW.supplier_id, 'info',
      CASE WHEN NEW.status='quote_requested' THEN 'Quote request ' ELSE 'New wholesale order ' END || NEW.order_number,
      'From ' || _bname || CASE WHEN NEW.status='quote_requested' THEN ' — send your prices.' ELSE ' — check the payment proof.' END, '/pharmacy?id=' || NEW.supplier_id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    _note := coalesce(nullif(current_setting('app.order_note', true), ''), CASE WHEN NEW.status IN ('confirmed','rejected','quoted') THEN NEW.supplier_note END);
    INSERT INTO wholesale_order_events(order_id, status, actor_id, note) VALUES (NEW.id, NEW.status, auth.uid(), _note);
    IF NEW.status IN ('completed','payment_submitted','cancelled') THEN
      PERFORM notify_user(_sup, NEW.supplier_id, CASE WHEN NEW.status='cancelled' THEN 'warning' ELSE 'success' END,
        'Order ' || NEW.order_number || CASE NEW.status WHEN 'completed' THEN ' received' WHEN 'cancelled' THEN ' quote declined' ELSE ' quote accepted & paid' END,
        _bname || CASE NEW.status WHEN 'completed' THEN ' confirmed delivery.' WHEN 'cancelled' THEN ' declined your quote.' ELSE ' sent payment proof — check and confirm.' END, '/pharmacy?id=' || NEW.supplier_id);
    ELSE
      PERFORM notify_user(_buy, NEW.buyer_pharmacy_id, CASE WHEN NEW.status='rejected' THEN 'warning' ELSE 'info' END,
        'Order ' || NEW.order_number || ' ' || replace(NEW.status,'_',' '),
        coalesce(_note, _sname || CASE WHEN NEW.status='delivered' THEN ' marked it delivered — confirm receipt to add stock.' WHEN NEW.status='quoted' THEN ' sent prices — accept and pay, or decline.' ELSE ' updated your order.' END),
        '/pharmacy?id=' || NEW.buyer_pharmacy_id);
    END IF;
  END IF;
  RETURN NEW;
END $function$;