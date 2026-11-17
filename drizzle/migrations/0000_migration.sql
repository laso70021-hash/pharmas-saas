-- Swahivo Pharmacy AI schema (migrated)

CREATE TYPE public.user_role AS ENUM (
  'super_admin','pharmacy_owner','pharmacist','cashier','manager',
  'accountant','supplier','delivery_rider','inventory_manager'
);
CREATE TYPE public.pharmacy_status AS ENUM ('active','pending','suspended','trial','expired');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles (separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid() OR public.is_platform_admin())
  WITH CHECK (id = auth.uid() OR public.is_platform_admin());

-- Subscription plans
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_tzs_monthly NUMERIC(15,2) NOT NULL DEFAULT 0,
  price_tzs_annual NUMERIC(15,2) NOT NULL DEFAULT 0,
  max_branches INTEGER NOT NULL DEFAULT 1,
  max_employees INTEGER NOT NULL DEFAULT 3,
  has_ai_insights BOOLEAN DEFAULT false,
  has_prescription_stt_ttt BOOLEAN DEFAULT false,
  has_advanced_ai_forecasting BOOLEAN DEFAULT false,
  has_bulk_import_ocr BOOLEAN DEFAULT false,
  has_delivery_management BOOLEAN DEFAULT false,
  support_tier TEXT DEFAULT 'email',
  features JSONB DEFAULT '[]'::jsonb,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view plans" ON public.subscription_plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage plans" ON public.subscription_plans FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Pharmacies
CREATE TABLE public.pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_number TEXT,
  tax_number TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT DEFAULT 'Dar es Salaam',
  country TEXT DEFAULT 'Tanzania',
  owner_name TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status public.pharmacy_status DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacies TO authenticated;
GRANT ALL ON public.pharmacies TO service_role;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

-- Branches
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  phone TEXT,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_main BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Memberships
CREATE TABLE public.pharmacy_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  role public.user_role NOT NULL DEFAULT 'pharmacist',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pharmacy_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_memberships TO authenticated;
GRANT ALL ON public.pharmacy_memberships TO service_role;
ALTER TABLE public.pharmacy_memberships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_belongs_to_pharmacy(pharmacy_uuid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pharmacy_uuid IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.pharmacy_memberships
            WHERE user_id = auth.uid() AND pharmacy_id = pharmacy_uuid AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.pharmacies WHERE id = pharmacy_uuid AND owner_id = auth.uid())
  )
$$;

CREATE POLICY "Pharmacy tenant access" ON public.pharmacies FOR ALL TO authenticated
  USING (public.is_platform_admin() OR owner_id = auth.uid() OR public.user_belongs_to_pharmacy(id))
  WITH CHECK (public.is_platform_admin() OR owner_id = auth.uid());
CREATE POLICY "Branch tenant access" ON public.branches FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Membership read" ON public.pharmacy_memberships FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR user_id = auth.uid() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Membership manage by owner or admin" ON public.pharmacy_memberships FOR ALL TO authenticated
  USING (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = pharmacy_id AND p.owner_id = auth.uid()))
  WITH CHECK (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = pharmacy_id AND p.owner_id = auth.uid()));

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Category read" ON public.categories FOR SELECT TO authenticated
  USING (pharmacy_id IS NULL OR public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Category write" ON public.categories FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  generic_name TEXT,
  sku TEXT,
  barcode TEXT,
  dosage_form TEXT,
  strength TEXT,
  cost_price NUMERIC(15,2) DEFAULT 0,
  selling_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  min_stock_level INTEGER DEFAULT 10,
  is_prescription_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Product tenant access" ON public.products FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

-- Inventory batches
CREATE TABLE public.inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(15,2) DEFAULT 0,
  expiry_date DATE NOT NULL,
  received_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_batches TO authenticated;
GRANT ALL ON public.inventory_batches TO service_role;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Batch tenant access" ON public.inventory_batches FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

-- Stock movements
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock movement tenant access" ON public.stock_movements FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supplier tenant access" ON public.suppliers FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer tenant access" ON public.customers FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount NUMERIC(15,2) DEFAULT 0,
  tax NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_status TEXT DEFAULT 'completed',
  payment_method TEXT DEFAULT 'cash',
  is_prescription_sale BOOLEAN DEFAULT false,
  prescription_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales tenant access" ON public.sales FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL,
  total_price NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sale items follow sale" ON public.sale_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (public.is_platform_admin() OR public.user_belongs_to_pharmacy(s.pharmacy_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (public.is_platform_admin() OR public.user_belongs_to_pharmacy(s.pharmacy_id))));

CREATE TABLE public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  payment_method TEXT NOT NULL,
  reference_code TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_payments TO authenticated;
GRANT ALL ON public.sale_payments TO service_role;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sale payments follow sale" ON public.sale_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (public.is_platform_admin() OR public.user_belongs_to_pharmacy(s.pharmacy_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND (public.is_platform_admin() OR public.user_belongs_to_pharmacy(s.pharmacy_id))));

-- Purchase orders
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  status TEXT DEFAULT 'ordered',
  total_amount NUMERIC(15,2) DEFAULT 0,
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  received_date DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Purchase orders tenant access" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(15,2) NOT NULL,
  total_cost NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PO items follow order" ON public.purchase_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND (public.is_platform_admin() OR public.user_belongs_to_pharmacy(po.pharmacy_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND (public.is_platform_admin() OR public.user_belongs_to_pharmacy(po.pharmacy_id))));

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Expenses tenant access" ON public.expenses FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

-- Deliveries
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  destination_address TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deliveries tenant access" ON public.deliveries FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id) OR rider_id = auth.uid())
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

-- Support tickets
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  ticket_number TEXT,
  subject TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tickets read" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR created_by = auth.uid() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Tickets create" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (pharmacy_id IS NULL OR public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id)));
CREATE POLICY "Tickets admin manage" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Tickets admin delete" ON public.support_tickets FOR DELETE TO authenticated
  USING (public.is_platform_admin());

-- AI features
CREATE TABLE public.ai_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_features TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_features TO authenticated;
GRANT ALL ON public.ai_features TO service_role;
ALTER TABLE public.ai_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view AI features" ON public.ai_features FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage AI features" ON public.ai_features FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- AI request logs
CREATE TABLE public.ai_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feature_slug TEXT NOT NULL,
  prompt_summary TEXT,
  response_summary TEXT,
  tokens_used INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  execution_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_request_logs TO authenticated;
GRANT ALL ON public.ai_request_logs TO service_role;
ALTER TABLE public.ai_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI logs access" ON public.ai_request_logs FOR ALL TO authenticated
  USING (public.is_platform_admin() OR user_id = auth.uid() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR user_id = auth.uid());

-- Stock alerts
CREATE TABLE public.stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_alerts TO authenticated;
GRANT ALL ON public.stock_alerts TO service_role;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock alerts tenant access" ON public.stock_alerts FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

-- AI recommendations
CREATE TABLE public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'inventory',
  severity TEXT DEFAULT 'action',
  action_type TEXT DEFAULT 'review',
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recommendations read" ON public.ai_recommendations FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Recommendations write" ON public.ai_recommendations FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id))
  WITH CHECK (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));

-- System health
CREATE TABLE public.system_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'operational',
  response_time_ms INTEGER DEFAULT 12,
  details TEXT,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_health_checks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_health_checks TO authenticated;
GRANT ALL ON public.system_health_checks TO service_role;
ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view system health" ON public.system_health_checks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage health checks" ON public.system_health_checks FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Platform settings
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view platform settings" ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage platform settings" ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT 'system',
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit logs read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Audit logs insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- New user: create profile, give first account the super admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'pharmacy_owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed configuration
INSERT INTO public.subscription_plans (slug, name, price_tzs_monthly, price_tzs_annual, max_branches, max_employees, has_ai_insights, has_prescription_stt_ttt, has_advanced_ai_forecasting, has_bulk_import_ocr, has_delivery_management, support_tier, features, display_order) VALUES
('starter','Starter',19000,15200,1,3,false,false,false,false,false,'email','["1 branch","Up to 3 employees","Core POS & inventory","Expiry & low-stock alerts","Email support"]'::jsonb,1),
('growth','Growth',39000,31200,2,10,true,true,false,false,false,'email','["Up to 2 branches","Up to 10 employees","All Starter features","AI stock & sales insights","Prescription (TTT/STT)","Supplier orders","Reports & exports"]'::jsonb,2),
('professional','Professional',69000,55200,5,25,true,true,true,true,true,'priority','["Up to 5 branches","Up to 25 employees","Advanced AI (expiry, demand, reorder recommendations)","Bulk medicine import (AI mapping)","Delivery management","Priority support"]'::jsonb,3),
('enterprise','Enterprise',0,0,999,999,true,true,true,true,true,'dedicated','["Unlimited branches","Unlimited employees","Full AI analytics & forecasting","Custom integrations (e.g. HIS/EMR)","Dedicated account manager","SLA & training"]'::jsonb,4);

INSERT INTO public.ai_features (slug, name, description, is_enabled, category) VALUES
('prescription-analysis','Prescription Analysis','AI-assisted digital prescription reading, STT/TTT dosage verification and safety checking',true,'clinical'),
('inventory-forecasting','Inventory Forecasting','Predictive demand modeling to prevent stockouts and overstocking across branches',true,'inventory'),
('expiry-prediction','Expiry Prediction','Automated 12, 6, and 3-month risk flagging for pharmaceutical batches',true,'inventory'),
('sales-insights','Sales Insights','Revenue trend identification, top-moving formulations, and basket analytics',true,'analytics'),
('ocr-import','OCR Import','Scans and converts supplier invoices and delivery notes directly into inventory batches',true,'operations'),
('fraud-detection','Fraud Detection','Detects duplicate supplier billings, sudden inventory variance, and abnormal returns',true,'security');

INSERT INTO public.system_health_checks (service_name, status, response_time_ms, details) VALUES
('Application','operational',12,'Application runtime healthy'),
('Database','operational',18,'Database connection pool operational'),
('Storage','operational',24,'Media storage available'),
('Background Jobs','operational',8,'Inventory recalculation workers active'),
('Email Service','operational',45,'Transactional email dispatcher connected'),
('Payment Gateway','operational',32,'Mobile money (M-Pesa, Airtel Money, Tigo Pesa) & card gateway operational');

INSERT INTO public.platform_settings (key, value, description) VALUES
('branding','{"name":"Swahivo Pharmacy AI","tagline":"Run Your Pharmacy Smarter with AI","primary_color":"#2563EB","currency":"TZS","support_email":"support@swahivo.com","phone":"+255 700 000 000"}'::jsonb,'Global brand configuration'),
('monetization','{"creator_commission_pct":10,"pharmacy_trial_days":14,"tax_rate":0.18}'::jsonb,'Billing and financial settings');
