CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users mark own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_user(_user uuid, _pharmacy uuid, _kind text, _title text, _body text, _link text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO notifications(user_id, pharmacy_id, kind, title, body, link)
  SELECT _user, _pharmacy, _kind, _title, _body, _link WHERE _user IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_notify_pharmacy_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM notify_user(NEW.owner_id, NEW.id, CASE WHEN NEW.status='rejected' THEN 'warning' ELSE 'success' END,
      CASE NEW.status WHEN 'trial' THEN 'Your account is approved — free trial started'
        WHEN 'active' THEN 'Your account is active' WHEN 'rejected' THEN 'Your registration was not approved'
        WHEN 'suspended' THEN 'Your account was suspended' ELSE 'Account status: ' || NEW.status END,
      coalesce(NEW.review_note, NEW.name), '/account');
  ELSIF NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    PERFORM notify_user(NEW.owner_id, NEW.id, 'success', 'Subscription dates updated',
      'Access now runs until ' || to_char(coalesce(NEW.subscription_ends_at, NEW.trial_ends_at), 'DD Mon YYYY'), '/account');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_pharmacy_status AFTER UPDATE ON public.pharmacies FOR EACH ROW EXECUTE FUNCTION public.trg_notify_pharmacy_status();

CREATE OR REPLACE FUNCTION public.trg_notify_sub_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT owner_id INTO _owner FROM pharmacies WHERE id = NEW.pharmacy_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO notifications(user_id, pharmacy_id, kind, title, body, link)
    SELECT ur.user_id, NEW.pharmacy_id, 'info', 'New payment to verify', 'TZS ' || NEW.amount_tzs || ' via ' || NEW.method, '/admin'
    FROM user_roles ur WHERE ur.role = 'super_admin';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM notify_user(_owner, NEW.pharmacy_id, CASE WHEN NEW.status='confirmed' THEN 'success' ELSE 'warning' END,
      CASE WHEN NEW.status='confirmed' THEN 'Payment confirmed' ELSE 'Payment was not accepted' END, NEW.review_note, '/account');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_sub_payment AFTER INSERT OR UPDATE ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.trg_notify_sub_payment();

CREATE OR REPLACE FUNCTION public.trg_notify_registration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications(user_id, pharmacy_id, kind, title, body, link)
  SELECT ur.user_id, NEW.id, 'info', 'New ' || NEW.business_type || ' registration', NEW.name, '/admin'
  FROM user_roles ur WHERE ur.role = 'super_admin';
  RETURN NEW;
END $$;
CREATE TRIGGER notify_registration AFTER INSERT ON public.pharmacies FOR EACH ROW EXECUTE FUNCTION public.trg_notify_registration();

CREATE OR REPLACE FUNCTION public.trg_notify_invite() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u uuid; _name text;
BEGIN
  SELECT id INTO _u FROM profiles WHERE lower(email) = lower(NEW.email) LIMIT 1;
  SELECT name INTO _name FROM pharmacies WHERE id = NEW.pharmacy_id;
  PERFORM notify_user(_u, NEW.pharmacy_id, 'info', 'You were invited to ' || _name, 'Role: ' || NEW.role || '. Open your account to accept.', '/account');
  RETURN NEW;
END $$;
CREATE TRIGGER notify_invite AFTER INSERT ON public.pharmacy_invites FOR EACH ROW EXECUTE FUNCTION public.trg_notify_invite();

CREATE OR REPLACE FUNCTION public.trg_notify_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text; _owner uuid;
BEGIN
  SELECT name, owner_id INTO _name, _owner FROM pharmacies WHERE id = NEW.pharmacy_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_user(_owner, NEW.pharmacy_id, 'success', 'New team member joined', 'Role: ' || NEW.role, '/pharmacy');
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    PERFORM notify_user(NEW.user_id, NEW.pharmacy_id, 'info', 'Your role changed at ' || _name, 'New role: ' || NEW.role, '/pharmacy');
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    PERFORM notify_user(NEW.user_id, NEW.pharmacy_id, 'warning', CASE WHEN NEW.is_active THEN 'Access restored at ' ELSE 'Access paused at ' END || _name, NULL, '/account');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_membership AFTER INSERT OR UPDATE ON public.pharmacy_memberships FOR EACH ROW EXECUTE FUNCTION public.trg_notify_membership();

CREATE OR REPLACE FUNCTION public.trg_notify_wholesale() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sup uuid; _buy uuid; _bname text;
BEGIN
  SELECT owner_id INTO _sup FROM pharmacies WHERE id = NEW.supplier_id;
  SELECT owner_id, name INTO _buy, _bname FROM pharmacies WHERE id = NEW.buyer_pharmacy_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_user(_sup, NEW.supplier_id, 'info', 'New wholesale order ' || NEW.order_number, 'From ' || _bname || ' — check the payment proof.', '/pharmacy?id=' || NEW.supplier_id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','rejected') THEN
    PERFORM notify_user(_buy, NEW.buyer_pharmacy_id, CASE WHEN NEW.status='completed' THEN 'success' ELSE 'warning' END,
      'Order ' || NEW.order_number || CASE WHEN NEW.status='completed' THEN ' confirmed — stock added' ELSE ' rejected' END,
      NEW.supplier_note, '/pharmacy?id=' || NEW.buyer_pharmacy_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_wholesale AFTER INSERT OR UPDATE ON public.wholesale_orders FOR EACH ROW EXECUTE FUNCTION public.trg_notify_wholesale();

CREATE OR REPLACE FUNCTION public.trg_notify_rx() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications(user_id, pharmacy_id, kind, title, body, link)
  SELECT m.user_id, NEW.pharmacy_id, 'info', 'Prescription waiting', NEW.patient_name, '/pharmacy?id=' || NEW.pharmacy_id
  FROM pharmacy_memberships m WHERE m.pharmacy_id = NEW.pharmacy_id AND m.role = 'pharmacist' AND m.is_active IS NOT FALSE
    AND (NEW.branch_id IS NULL OR m.branch_id IS NULL OR m.branch_id = NEW.branch_id);
  RETURN NEW;
END $$;
CREATE TRIGGER notify_rx AFTER INSERT ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.trg_notify_rx();

REVOKE EXECUTE ON FUNCTION public.trg_notify_pharmacy_status(), public.trg_notify_sub_payment(), public.trg_notify_registration(),
  public.trg_notify_invite(), public.trg_notify_membership(), public.trg_notify_wholesale(), public.trg_notify_rx() FROM PUBLIC, anon, authenticated;