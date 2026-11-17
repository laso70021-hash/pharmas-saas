CREATE TABLE public.wholesale_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE CASCADE,
  status text NOT NULL, actor_id uuid, note text,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.wholesale_order_events TO authenticated;
GRANT ALL ON public.wholesale_order_events TO service_role;
ALTER TABLE public.wholesale_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order parties read timeline" ON public.wholesale_order_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.wholesale_orders o WHERE o.id = order_id
  AND (public.user_belongs_to_pharmacy(o.buyer_pharmacy_id) OR public.user_belongs_to_pharmacy(o.supplier_id))));
CREATE INDEX ON public.wholesale_order_events(order_id, created_at);

CREATE TABLE public.wholesale_order_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.wholesale_order_items(id) ON DELETE CASCADE,
  batch_number text NOT NULL, expiry_date date NOT NULL, quantity int NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wholesale_order_allocations TO service_role;
ALTER TABLE public.wholesale_order_allocations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.review_wholesale_order(_order uuid, _decision text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _o record; _it record; _b record; _need int; _take int;
BEGIN
  PERFORM set_config('app.wholesale_transfer','on',true);
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
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = _it.supplier_product_id AND pharmacy_id = _o.supplier_id) THEN
      RAISE EXCEPTION '% is no longer in your catalog', _it.product_name; END IF;
    _need := _it.quantity;
    FOR _b IN SELECT * FROM inventory_batches WHERE product_id = _it.supplier_product_id AND quantity > 0 AND expiry_date >= current_date
      ORDER BY expiry_date FOR UPDATE LOOP
      EXIT WHEN _need <= 0;
      _take := least(_need, _b.quantity);
      UPDATE inventory_batches SET quantity = quantity - _take, updated_at = now() WHERE id = _b.id;
      INSERT INTO stock_movements(pharmacy_id, product_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
      VALUES (_o.supplier_id, _it.supplier_product_id, _b.id, 'wholesale_out', -_take, _order, 'Order ' || _o.order_number, auth.uid());
      INSERT INTO wholesale_order_allocations(order_id, item_id, batch_number, expiry_date, quantity)
      VALUES (_order, _it.id, _b.batch_number, _b.expiry_date, _take);
      _need := _need - _take;
    END LOOP;
    IF _need > 0 THEN RAISE EXCEPTION 'Not enough stock of % to fill this order', _it.product_name; END IF;
  END LOOP;
  UPDATE wholesale_orders SET status='confirmed', supplier_note=_note, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_order;
END $function$;

CREATE OR REPLACE FUNCTION public.advance_wholesale_order(_order uuid, _status text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _o record; _next text;
BEGIN
  SELECT * INTO _o FROM wholesale_orders WHERE id = _order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT public.can_write_pharmacy(_o.supplier_id, ARRAY['manager','inventory_manager','delivery_rider']::user_role[]) THEN
    RAISE EXCEPTION 'Only the supplier can update this order'; END IF;
  _next := CASE _o.status WHEN 'confirmed' THEN 'preparing' WHEN 'preparing' THEN 'dispatched'
    WHEN 'dispatched' THEN 'in_transit' WHEN 'in_transit' THEN 'delivered' END;
  IF _next IS NULL OR _status <> _next THEN RAISE EXCEPTION 'Order is % — next step is %', _o.status, coalesce(_next, 'none'); END IF;
  PERFORM set_config('app.order_note', coalesce(_note,''), true);
  UPDATE wholesale_orders SET status=_next WHERE id=_order;
END $function$;

CREATE OR REPLACE FUNCTION public.receive_wholesale_order(_order uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _o record; _it record; _sp record; _a record; _bp uuid;
BEGIN
  PERFORM set_config('app.wholesale_transfer','on',true);
  SELECT * INTO _o FROM wholesale_orders WHERE id = _order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT public.can_write_pharmacy(_o.buyer_pharmacy_id, ARRAY['manager','inventory_manager']::user_role[]) THEN
    RAISE EXCEPTION 'Only the buying pharmacy can receive this order'; END IF;
  IF _o.status NOT IN ('dispatched','in_transit','delivered') THEN RAISE EXCEPTION 'This order has not been dispatched yet'; END IF;
  FOR _it IN SELECT * FROM wholesale_order_items WHERE order_id = _order LOOP
    SELECT * INTO _sp FROM products WHERE id = _it.supplier_product_id;
    _bp := NULL;
    SELECT id INTO _bp FROM products WHERE pharmacy_id = _o.buyer_pharmacy_id
      AND lower(name) = lower(coalesce(_sp.name, _it.product_name)) AND coalesce(lower(strength),'') = coalesce(lower(_sp.strength),'') LIMIT 1;
    IF _bp IS NULL THEN
      INSERT INTO products(pharmacy_id, name, generic_name, dosage_form, strength, cost_price, selling_price, is_prescription_required, image_url, is_active)
      VALUES (_o.buyer_pharmacy_id, coalesce(_sp.name, _it.product_name), _sp.generic_name, _sp.dosage_form, _sp.strength, _it.unit_price,
        round(_it.unit_price * 1.3), coalesce(_sp.is_prescription_required,false), _sp.image_url, true) RETURNING id INTO _bp;
    ELSE
      UPDATE products SET cost_price = _it.unit_price, image_url = coalesce(image_url, _sp.image_url) WHERE id = _bp;
    END IF;
    FOR _a IN SELECT * FROM wholesale_order_allocations WHERE item_id = _it.id LOOP
      WITH nb AS (
        INSERT INTO inventory_batches(pharmacy_id, branch_id, product_id, batch_number, quantity, cost_per_unit, expiry_date, received_date)
        VALUES (_o.buyer_pharmacy_id, _o.branch_id, _bp, _a.batch_number, _a.quantity, _it.unit_price, _a.expiry_date, current_date) RETURNING id)
      INSERT INTO stock_movements(pharmacy_id, product_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
      SELECT _o.buyer_pharmacy_id, _bp, nb.id, 'stock_in', _a.quantity, _order, 'Supplier order ' || _o.order_number, auth.uid() FROM nb;
    END LOOP;
  END LOOP;
  PERFORM set_config('app.order_note', coalesce(_note,''), true);
  UPDATE wholesale_orders SET status='completed' WHERE id=_order;
END $function$;

REVOKE ALL ON FUNCTION public.advance_wholesale_order(uuid,text,text), public.receive_wholesale_order(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_wholesale_order(uuid,text,text), public.receive_wholesale_order(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_notify_wholesale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _sup uuid; _buy uuid; _bname text; _sname text; _note text;
BEGIN
  SELECT owner_id, name INTO _sup, _sname FROM pharmacies WHERE id = NEW.supplier_id;
  SELECT owner_id, name INTO _buy, _bname FROM pharmacies WHERE id = NEW.buyer_pharmacy_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO wholesale_order_events(order_id, status, actor_id) VALUES (NEW.id, NEW.status, auth.uid());
    PERFORM notify_user(_sup, NEW.supplier_id, 'info', 'New wholesale order ' || NEW.order_number, 'From ' || _bname || ' — check the payment proof.', '/pharmacy?id=' || NEW.supplier_id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    _note := coalesce(nullif(current_setting('app.order_note', true), ''), CASE WHEN NEW.status IN ('confirmed','rejected') THEN NEW.supplier_note END);
    INSERT INTO wholesale_order_events(order_id, status, actor_id, note) VALUES (NEW.id, NEW.status, auth.uid(), _note);
    IF NEW.status = 'completed' THEN
      PERFORM notify_user(_sup, NEW.supplier_id, 'success', 'Order ' || NEW.order_number || ' received', _bname || ' confirmed delivery.', '/pharmacy?id=' || NEW.supplier_id);
    ELSE
      PERFORM notify_user(_buy, NEW.buyer_pharmacy_id, CASE WHEN NEW.status='rejected' THEN 'warning' ELSE 'info' END,
        'Order ' || NEW.order_number || ' ' || replace(NEW.status,'_',' '),
        coalesce(_note, _sname || CASE WHEN NEW.status='delivered' THEN ' marked it delivered — confirm receipt to add stock.' ELSE ' updated your order.' END),
        '/pharmacy?id=' || NEW.buyer_pharmacy_id);
    END IF;
  END IF;
  RETURN NEW;
END $function$;

INSERT INTO public.wholesale_order_events(order_id, status, created_at)
SELECT id, status, coalesce(reviewed_at, created_at) FROM public.wholesale_orders;