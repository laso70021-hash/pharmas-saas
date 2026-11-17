CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  patient_phone text,
  prescriber text,
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dispensed','rejected')),
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  review_note text,
  created_by uuid,
  dispensed_by uuid,
  dispensed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read prescriptions" ON public.prescriptions FOR SELECT TO authenticated
  USING (public.user_belongs_to_pharmacy(pharmacy_id));
CREATE POLICY "Staff add prescriptions" ON public.prescriptions FOR INSERT TO authenticated
  WITH CHECK (status = 'pending' AND public.can_write_pharmacy(pharmacy_id, ARRAY['manager','pharmacist','cashier']::user_role[]));

CREATE OR REPLACE FUNCTION public.review_prescription(_id uuid, _decision text, _method text, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rx record; _sale uuid;
BEGIN
  SELECT * INTO _rx FROM prescriptions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prescription not found'; END IF;
  IF NOT public.can_write_pharmacy(_rx.pharmacy_id, ARRAY['manager','pharmacist']::user_role[]) THEN
    RAISE EXCEPTION 'Only a pharmacist or manager can dispense'; END IF;
  IF _rx.status <> 'pending' THEN RAISE EXCEPTION 'Already handled'; END IF;
  IF _decision = 'reject' THEN
    UPDATE prescriptions SET status='rejected', review_note=_note, dispensed_by=auth.uid(), dispensed_at=now() WHERE id=_id;
    RETURN NULL;
  ELSIF _decision <> 'dispense' THEN RAISE EXCEPTION 'Unknown decision'; END IF;
  IF _rx.branch_id IS NULL THEN RAISE EXCEPTION 'Prescription has no branch'; END IF;
  _sale := public.create_sale(_rx.pharmacy_id, _rx.branch_id, _rx.items, _method, 0, NULL);
  UPDATE sales SET is_prescription_sale = true, prescription_notes = concat_ws(' · ', _rx.patient_name, _rx.prescriber, _rx.notes) WHERE id=_sale;
  UPDATE prescriptions SET status='dispensed', sale_id=_sale, review_note=_note, dispensed_by=auth.uid(), dispensed_at=now() WHERE id=_id;
  RETURN _sale;
END $$;
REVOKE EXECUTE ON FUNCTION public.review_prescription(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_prescription(uuid,text,text,text) TO authenticated;