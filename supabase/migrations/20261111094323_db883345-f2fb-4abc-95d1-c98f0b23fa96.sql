CREATE TABLE public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 200),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  business_name text CHECK (business_name IS NULL OR char_length(business_name) <= 160),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_submissions TO anon, authenticated;
GRANT SELECT ON public.contact_submissions TO authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can send a contact message" ON public.contact_submissions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read contact messages" ON public.contact_submissions FOR SELECT TO authenticated USING (public.is_platform_admin());
UPDATE public.subscription_plans SET features = (
  SELECT jsonb_agg(to_jsonb(replace(replace(replace(f,'stores','MedPoints'),'store','MedPoint'),'Store','MedPoint'))) FROM jsonb_array_elements_text(features::jsonb) f
) WHERE features::text ilike '%store%';