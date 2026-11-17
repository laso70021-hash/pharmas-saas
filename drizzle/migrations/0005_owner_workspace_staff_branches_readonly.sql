-- Product photos for the catalogue / POS grid
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

-- ---------- helper functions ----------
CREATE OR REPLACE FUNCTION public.try_uuid(_value text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  RETURN _value::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- Subscription is usable today (trial not ended / paid year not ended)
CREATE OR REPLACE FUNCTION public.pharmacy_is_current(_pharmacy_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pharmacies
    WHERE id = _pharmacy_id
      AND ((status = 'trial' AND trial_ends_at > now())
        OR (status = 'active' AND (subscription_ends_at IS NULL OR subscription_ends_at > now())))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_pharmacy_owner(_pharmacy_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pharmacies WHERE id = _pharmacy_id AND owner_id = auth.uid())
$$;

-- Owner counts as every role; staff need an active membership with one of the roles
CREATE OR REPLACE FUNCTION public.has_pharmacy_role(_pharmacy_id uuid, _roles public.user_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _pharmacy_id IS NOT NULL AND (
    public.is_pharmacy_owner(_pharmacy_id)
    OR EXISTS (SELECT 1 FROM public.pharmacy_memberships
               WHERE pharmacy_id = _pharmacy_id AND user_id = auth.uid()
                 AND is_active = true AND role = ANY(_roles))
  )
$$;

-- Writes need the right role AND a current subscription (expired = read-only); admins always may
CREATE OR REPLACE FUNCTION public.can_write_pharmacy(_pharmacy_id uuid, _roles public.user_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin()
    OR (public.pharmacy_is_current(_pharmacy_id) AND public.has_pharmacy_role(_pharmacy_id, _roles))
$$;

-- ---------- staff invitations ----------
CREATE TABLE public.pharmacy_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role public.user_role NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT pharmacy_invites_status_check CHECK (status IN ('pending', 'accepted', 'revoked')),
  CONSTRAINT pharmacy_invites_role_check CHECK (role IN ('pharmacist', 'cashier', 'manager', 'accountant', 'delivery_rider', 'inventory_manager'))
);
CREATE UNIQUE INDEX pharmacy_invites_pending_email ON public.pharmacy_invites (pharmacy_id, lower(email)) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_invites TO authenticated;
GRANT ALL ON public.pharmacy_invites TO service_role;
ALTER TABLE public.pharmacy_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invites read by owner, manager or admin" ON public.pharmacy_invites
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.has_pharmacy_role(pharmacy_id, ARRAY['manager']::public.user_role[]));
CREATE POLICY "Invites managed by owner or admin" ON public.pharmacy_invites
  FOR ALL TO authenticated
  USING (public.is_platform_admin() OR (public.is_pharmacy_owner(pharmacy_id) AND public.pharmacy_is_current(pharmacy_id)))
  WITH CHECK (public.is_platform_admin() OR (public.is_pharmacy_owner(pharmacy_id) AND public.pharmacy_is_current(pharmacy_id)));

-- ---------- plan limits ----------
CREATE OR REPLACE FUNCTION public.pharmacy_plan_limits(_pharmacy_id uuid, OUT max_branches integer, OUT max_employees integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sp.max_branches, 1), COALESCE(sp.max_employees, 3)
  FROM public.pharmacies p LEFT JOIN public.subscription_plans sp ON sp.id = p.plan_id
  WHERE p.id = _pharmacy_id
$$;

CREATE OR REPLACE FUNCTION public.enforce_branch_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
  v_max integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.branches WHERE pharmacy_id = NEW.pharmacy_id;
  IF v_count = 0 THEN
    NEW.is_main := true;
  END IF;
  IF NOT public.is_platform_admin() THEN
    SELECT l.max_branches INTO v_max FROM public.pharmacy_plan_limits(NEW.pharmacy_id) l;
    IF v_count >= COALESCE(v_max, 1) THEN
      RAISE EXCEPTION 'Your plan allows % branch(es). Upgrade your plan to add more.', COALESCE(v_max, 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER branches_enforce_rules BEFORE INSERT ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_rules();

CREATE OR REPLACE FUNCTION public.enforce_invite_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_used integer;
  v_max integer;
BEGIN
  NEW.email := lower(trim(NEW.email));
  IF NEW.invited_by IS NULL THEN NEW.invited_by := auth.uid(); END IF;
  IF public.is_platform_admin() THEN RETURN NEW; END IF;
  SELECT l.max_employees INTO v_max FROM public.pharmacy_plan_limits(NEW.pharmacy_id) l;
  SELECT (SELECT count(*) FROM public.pharmacy_memberships WHERE pharmacy_id = NEW.pharmacy_id AND is_active = true)
       + (SELECT count(*) FROM public.pharmacy_invites WHERE pharmacy_id = NEW.pharmacy_id AND status = 'pending')
    INTO v_used;
  IF v_used >= COALESCE(v_max, 3) THEN
    RAISE EXCEPTION 'Your plan allows % staff member(s). Upgrade your plan to invite more.', COALESCE(v_max, 3);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pharmacy_invites_enforce_limit BEFORE INSERT ON public.pharmacy_invites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invite_limit();

CREATE OR REPLACE FUNCTION public.enforce_membership_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_used integer;
  v_max integer;
BEGIN
  IF public.is_platform_admin() THEN RETURN NEW; END IF;
  IF NEW.role IN ('super_admin', 'pharmacy_owner', 'supplier') THEN
    RAISE EXCEPTION 'That role cannot be given to staff';
  END IF;
  IF NEW.is_active AND (TG_OP = 'INSERT' OR OLD.is_active IS DISTINCT FROM true) THEN
    SELECT l.max_employees INTO v_max FROM public.pharmacy_plan_limits(NEW.pharmacy_id) l;
    SELECT count(*) INTO v_used FROM public.pharmacy_memberships
      WHERE pharmacy_id = NEW.pharmacy_id AND is_active = true AND id <> NEW.id;
    IF v_used >= COALESCE(v_max, 3) THEN
      RAISE EXCEPTION 'Your plan allows % staff member(s). Upgrade your plan to add more.', COALESCE(v_max, 3);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pharmacy_memberships_enforce_rules BEFORE INSERT OR UPDATE ON public.pharmacy_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_membership_rules();

-- ---------- RPCs ----------
CREATE OR REPLACE FUNCTION public.pharmacy_staff(_pharmacy_id uuid)
RETURNS TABLE (membership_id uuid, user_id uuid, full_name text, email text, role public.user_role, branch_id uuid, is_active boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.user_id, pr.full_name, pr.email, m.role, m.branch_id, COALESCE(m.is_active, true), m.created_at
  FROM public.pharmacy_memberships m
  JOIN public.profiles pr ON pr.id = m.user_id
  WHERE m.pharmacy_id = _pharmacy_id
    AND (public.is_platform_admin() OR public.has_pharmacy_role(_pharmacy_id, ARRAY['manager']::public.user_role[]))
  ORDER BY m.created_at
$$;

CREATE OR REPLACE FUNCTION public.my_invitations()
RETURNS TABLE (id uuid, pharmacy_id uuid, pharmacy_name text, role public.user_role, branch_name text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.pharmacy_id, p.name, i.role, b.name, i.created_at
  FROM public.pharmacy_invites i
  JOIN public.pharmacies p ON p.id = i.pharmacy_id
  LEFT JOIN public.branches b ON b.id = i.branch_id
  WHERE i.status = 'pending'
    AND lower(i.email) = (SELECT lower(u.email) FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL)
  ORDER BY i.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_invite_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.pharmacy_invites%ROWTYPE;
  v_email text;
BEGIN
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Please confirm your email address first'; END IF;

  SELECT * INTO v_inv FROM public.pharmacy_invites
    WHERE id = _invite_id AND status = 'pending' AND lower(email) = lower(v_email);
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF NOT public.pharmacy_is_current(v_inv.pharmacy_id) THEN
    RAISE EXCEPTION 'This pharmacy account is not active right now. Ask the owner to renew it.';
  END IF;

  -- The invite is being used now, so it no longer holds a staff seat
  UPDATE public.pharmacy_invites SET status = 'accepted', accepted_at = now() WHERE id = v_inv.id;

  IF EXISTS (SELECT 1 FROM public.pharmacy_memberships WHERE pharmacy_id = v_inv.pharmacy_id AND user_id = auth.uid()) THEN
    UPDATE public.pharmacy_memberships SET role = v_inv.role, branch_id = v_inv.branch_id, is_active = true
      WHERE pharmacy_id = v_inv.pharmacy_id AND user_id = auth.uid();
  ELSE
    INSERT INTO public.pharmacy_memberships (pharmacy_id, user_id, branch_id, role, is_active)
      VALUES (v_inv.pharmacy_id, auth.uid(), v_inv.branch_id, v_inv.role, true);
  END IF;

  INSERT INTO public.audit_logs (pharmacy_id, user_id, action, entity, entity_id, details)
  VALUES (v_inv.pharmacy_id, auth.uid(), 'invite_accepted', 'pharmacy_membership', v_inv.id::text, jsonb_build_object('role', v_inv.role));
  RETURN v_inv.pharmacy_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pharmacy_is_current(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_pharmacy_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_pharmacy_role(uuid, public.user_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write_pharmacy(uuid, public.user_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_plan_limits(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_invitations() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_branch_rules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_invite_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_membership_rules() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pharmacy_is_current(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pharmacy_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_pharmacy_role(uuid, public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_pharmacy(uuid, public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pharmacy_plan_limits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pharmacy_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

-- ---------- tenant policies: members read, role + current subscription to write ----------
DROP POLICY IF EXISTS "Branch tenant access" ON public.branches;
CREATE POLICY "Branch read" ON public.branches FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Branch write" ON public.branches FOR ALL TO authenticated
  USING (public.can_write_pharmacy(pharmacy_id, ARRAY['manager']::public.user_role[]))
  WITH CHECK (public.can_write_pharmacy(pharmacy_id, ARRAY['manager']::public.user_role[]));

DROP POLICY IF EXISTS "Category write" ON public.categories;
CREATE POLICY "Category write" ON public.categories FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager','pharmacist']::public.user_role[]))
  WITH CHECK (public.is_platform_admin() OR public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager','pharmacist']::public.user_role[]));

DROP POLICY IF EXISTS "Product tenant access" ON public.products;
CREATE POLICY "Product read" ON public.products FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Product write" ON public.products FOR ALL TO authenticated
  USING (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager','pharmacist']::public.user_role[]))
  WITH CHECK (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager','pharmacist']::public.user_role[]));

DROP POLICY IF EXISTS "Batch tenant access" ON public.inventory_batches;
CREATE POLICY "Batch read" ON public.inventory_batches FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Batch write" ON public.inventory_batches FOR ALL TO authenticated
  USING (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager','pharmacist']::public.user_role[]))
  WITH CHECK (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager','pharmacist']::public.user_role[]));

DROP POLICY IF EXISTS "Stock movement tenant access" ON public.stock_movements;
CREATE POLICY "Stock movement read" ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Stock movement write" ON public.stock_movements FOR ALL TO authenticated
  USING (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager','pharmacist','cashier']::public.user_role[]))
  WITH CHECK (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager','pharmacist','cashier']::public.user_role[]));

DROP POLICY IF EXISTS "Supplier tenant access" ON public.suppliers;
CREATE POLICY "Supplier read" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Supplier write" ON public.suppliers FOR ALL TO authenticated
  USING (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager']::public.user_role[]))
  WITH CHECK (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager']::public.user_role[]));

DROP POLICY IF EXISTS "Purchase orders tenant access" ON public.purchase_orders;
CREATE POLICY "Purchase orders read" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Purchase orders write" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager']::public.user_role[]))
  WITH CHECK (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager']::public.user_role[]));

DROP POLICY IF EXISTS "PO items follow order" ON public.purchase_order_items;
CREATE POLICY "PO items read" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id
    AND (public.is_platform_admin() OR public.user_belongs_to_pharmacy(po.pharmacy_id))));
CREATE POLICY "PO items write" ON public.purchase_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id
    AND public.can_write_pharmacy(po.pharmacy_id, ARRAY['manager','inventory_manager']::public.user_role[])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id
    AND public.can_write_pharmacy(po.pharmacy_id, ARRAY['manager','inventory_manager']::public.user_role[])));

DROP POLICY IF EXISTS "Sales tenant access" ON public.sales;
CREATE POLICY "Sales read" ON public.sales FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Sales write" ON public.sales FOR ALL TO authenticated
  USING (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','pharmacist','cashier']::public.user_role[]))
  WITH CHECK (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','pharmacist','cashier']::public.user_role[]));

DROP POLICY IF EXISTS "Sale items follow sale" ON public.sale_items;
CREATE POLICY "Sale items read" ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND (public.is_platform_admin() OR public.user_belongs_to_pharmacy(s.pharmacy_id))));
CREATE POLICY "Sale items write" ON public.sale_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND public.can_write_pharmacy(s.pharmacy_id, ARRAY['manager','pharmacist','cashier']::public.user_role[])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND public.can_write_pharmacy(s.pharmacy_id, ARRAY['manager','pharmacist','cashier']::public.user_role[])));

DROP POLICY IF EXISTS "Sale payments follow sale" ON public.sale_payments;
CREATE POLICY "Sale payments read" ON public.sale_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND (public.is_platform_admin() OR public.user_belongs_to_pharmacy(s.pharmacy_id))));
CREATE POLICY "Sale payments write" ON public.sale_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND public.can_write_pharmacy(s.pharmacy_id, ARRAY['manager','pharmacist','cashier']::public.user_role[])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND public.can_write_pharmacy(s.pharmacy_id, ARRAY['manager','pharmacist','cashier']::public.user_role[])));

DROP POLICY IF EXISTS "Customer tenant access" ON public.customers;
CREATE POLICY "Customer read" ON public.customers FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Customer write" ON public.customers FOR ALL TO authenticated
  USING (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','pharmacist','cashier']::public.user_role[]))
  WITH CHECK (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','pharmacist','cashier']::public.user_role[]));

DROP POLICY IF EXISTS "Expenses tenant access" ON public.expenses;
CREATE POLICY "Expenses read" ON public.expenses FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Expenses write" ON public.expenses FOR ALL TO authenticated
  USING (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','accountant']::public.user_role[]))
  WITH CHECK (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','accountant']::public.user_role[]));

DROP POLICY IF EXISTS "Stock alerts tenant access" ON public.stock_alerts;
CREATE POLICY "Stock alerts read" ON public.stock_alerts FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Stock alerts write" ON public.stock_alerts FOR ALL TO authenticated
  USING (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager','pharmacist','cashier','accountant','delivery_rider']::public.user_role[]))
  WITH CHECK (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','inventory_manager','pharmacist','cashier','accountant','delivery_rider']::public.user_role[]));

DROP POLICY IF EXISTS "Deliveries tenant access" ON public.deliveries;
CREATE POLICY "Deliveries read" ON public.deliveries FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id) OR rider_id = auth.uid());
CREATE POLICY "Deliveries write" ON public.deliveries FOR ALL TO authenticated
  USING (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','pharmacist','cashier','delivery_rider']::public.user_role[]))
  WITH CHECK (public.can_write_pharmacy(pharmacy_id, ARRAY['manager','pharmacist','cashier','delivery_rider']::public.user_role[]));

DROP POLICY IF EXISTS "Membership manage by owner or admin" ON public.pharmacy_memberships;
CREATE POLICY "Membership manage by owner or admin" ON public.pharmacy_memberships FOR ALL TO authenticated
  USING (public.is_platform_admin() OR (public.is_pharmacy_owner(pharmacy_id) AND public.pharmacy_is_current(pharmacy_id)))
  WITH CHECK (public.is_platform_admin() OR (public.is_pharmacy_owner(pharmacy_id) AND public.pharmacy_is_current(pharmacy_id)));

-- ---------- product photos (public bucket, folder = pharmacy id) ----------
CREATE POLICY "Stock staff upload product photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images'
    AND public.can_write_pharmacy(public.try_uuid((storage.foldername(name))[1]), ARRAY['manager','inventory_manager','pharmacist']::public.user_role[]));
CREATE POLICY "Stock staff update product photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images'
    AND public.can_write_pharmacy(public.try_uuid((storage.foldername(name))[1]), ARRAY['manager','inventory_manager','pharmacist']::public.user_role[]));
CREATE POLICY "Stock staff delete product photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images'
    AND public.can_write_pharmacy(public.try_uuid((storage.foldername(name))[1]), ARRAY['manager','inventory_manager','pharmacist']::public.user_role[]));