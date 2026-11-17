DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;
CREATE POLICY "Admins can view platform settings" ON public.platform_settings FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS "Anyone can view system health" ON public.system_health_checks;
CREATE POLICY "Admins can view system health" ON public.system_health_checks FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS "Anyone can send a contact message" ON public.contact_submissions;
CREATE POLICY "Anyone can send a valid contact message" ON public.contact_submissions FOR INSERT TO anon, authenticated WITH CHECK (
  char_length(btrim(full_name)) BETWEEN 1 AND 120
  AND char_length(email) BETWEEN 3 AND 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (phone IS NULL OR char_length(phone) <= 40)
  AND (business_name IS NULL OR char_length(business_name) <= 160)
  AND char_length(btrim(message)) BETWEEN 1 AND 5000
);