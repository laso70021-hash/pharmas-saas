CREATE TABLE public.covlo_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.covlo_threads TO authenticated;
GRANT ALL ON public.covlo_threads TO service_role;
ALTER TABLE public.covlo_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own Covlo threads" ON public.covlo_threads FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND (public.user_belongs_to_pharmacy(pharmacy_id) OR public.is_platform_admin()));
CREATE INDEX covlo_threads_user_idx ON public.covlo_threads(user_id, pharmacy_id, updated_at DESC);

CREATE TABLE public.covlo_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.covlo_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.covlo_messages TO authenticated;
GRANT ALL ON public.covlo_messages TO service_role;
ALTER TABLE public.covlo_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own Covlo messages" ON public.covlo_messages FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.covlo_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE INDEX covlo_messages_thread_idx ON public.covlo_messages(thread_id, created_at);