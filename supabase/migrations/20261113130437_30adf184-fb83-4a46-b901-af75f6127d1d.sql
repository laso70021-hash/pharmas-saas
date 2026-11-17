CREATE TABLE public.employee_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  scheduled_minutes integer NOT NULL DEFAULT 480,
  extended_minutes integer NOT NULL DEFAULT 0,
  break_seconds integer NOT NULL DEFAULT 0,
  break_started_at timestamptz,
  handover_to uuid REFERENCES public.profiles(id),
  handover_from_shift uuid REFERENCES public.employee_shifts(id),
  accepted_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX employee_shifts_one_open ON public.employee_shifts(user_id) WHERE ended_at IS NULL;
CREATE INDEX employee_shifts_pharmacy ON public.employee_shifts(pharmacy_id, started_at DESC);
GRANT SELECT ON public.employee_shifts TO authenticated;
GRANT ALL ON public.employee_shifts TO service_role;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or managed shifts readable" ON public.employee_shifts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_pharmacy_owner(pharmacy_id) OR public.has_pharmacy_role(pharmacy_id, ARRAY['manager']::public.user_role[]) OR public.is_platform_admin());

CREATE TABLE public.shift_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.employee_shifts(id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  minutes integer,
  target_user uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shift_events_shift ON public.shift_events(shift_id, created_at);
GRANT SELECT ON public.shift_events TO authenticated;
GRANT ALL ON public.shift_events TO service_role;
ALTER TABLE public.shift_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events follow shift visibility" ON public.shift_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.employee_shifts s WHERE s.id = shift_id));

CREATE OR REPLACE FUNCTION public.shift_action(_pharmacy uuid, _action text, _branch uuid DEFAULT NULL, _minutes integer DEFAULT NULL, _to_user uuid DEFAULT NULL, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); s public.employee_shifts; t timestamptz := now(); new_id uuid; mgr boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT public.user_belongs_to_pharmacy(_pharmacy) THEN RAISE EXCEPTION 'Not a member of this business'; END IF;
  IF NOT public.pharmacy_is_current(_pharmacy) THEN RAISE EXCEPTION 'Account is read-only until payment is confirmed'; END IF;
  mgr := public.is_pharmacy_owner(_pharmacy) OR public.has_pharmacy_role(_pharmacy, ARRAY['manager']::public.user_role[]);

  IF _action = 'start' THEN
    IF _branch IS NOT NULL AND NOT public.can_access_branch(_pharmacy, _branch) THEN RAISE EXCEPTION 'No access to this branch'; END IF;
    -- accept a pending handover addressed to me
    SELECT * INTO s FROM public.employee_shifts WHERE pharmacy_id = _pharmacy AND handover_to = uid AND accepted_at IS NULL AND status = 'transferred' ORDER BY ended_at DESC LIMIT 1 FOR UPDATE;
    BEGIN
      INSERT INTO public.employee_shifts(pharmacy_id, branch_id, user_id, started_at, scheduled_minutes, handover_from_shift)
      VALUES (_pharmacy, COALESCE(_branch, s.branch_id), uid, COALESCE(s.ended_at, t), GREATEST(COALESCE(_minutes, 480), 30), s.id)
      RETURNING id INTO new_id;
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'You already have an open shift'; END;
    IF s.id IS NOT NULL THEN
      UPDATE public.employee_shifts SET accepted_at = t, updated_at = t WHERE id = s.id;
      INSERT INTO public.shift_events(shift_id, pharmacy_id, actor_id, action, note) VALUES (s.id, _pharmacy, uid, 'handover_accepted', 'Accepted at ' || t::text);
    END IF;
    INSERT INTO public.shift_events(shift_id, pharmacy_id, actor_id, action, minutes) VALUES (new_id, _pharmacy, uid, 'start', _minutes);
    RETURN new_id;
  END IF;

  SELECT * INTO s FROM public.employee_shifts WHERE user_id = uid AND pharmacy_id = _pharmacy AND ended_at IS NULL FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'No open shift'; END IF;

  IF _action = 'break' THEN
    IF s.status = 'on_break' THEN RAISE EXCEPTION 'Already on break'; END IF;
    UPDATE public.employee_shifts SET status = 'on_break', break_started_at = t, updated_at = t WHERE id = s.id;
  ELSIF _action = 'resume' THEN
    IF s.status <> 'on_break' THEN RAISE EXCEPTION 'Not on break'; END IF;
    UPDATE public.employee_shifts SET status = 'active', break_seconds = break_seconds + EXTRACT(EPOCH FROM t - break_started_at)::int, break_started_at = NULL, updated_at = t WHERE id = s.id;
  ELSIF _action = 'extend' THEN
    IF COALESCE(_minutes, 0) <= 0 OR _minutes > 720 THEN RAISE EXCEPTION 'Extension must be 1–720 minutes'; END IF;
    IF NOT mgr AND COALESCE(trim(_note), '') = '' THEN RAISE EXCEPTION 'Give the name of the manager who authorised the extension'; END IF;
    UPDATE public.employee_shifts SET extended_minutes = extended_minutes + _minutes, updated_at = t WHERE id = s.id;
  ELSIF _action IN ('end', 'transfer') THEN
    IF _action = 'transfer' THEN
      IF _to_user IS NULL OR _to_user = uid THEN RAISE EXCEPTION 'Choose the incoming employee'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.pharmacy_memberships m WHERE m.pharmacy_id = _pharmacy AND m.user_id = _to_user AND COALESCE(m.is_active, true))
         AND NOT EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = _pharmacy AND p.owner_id = _to_user) THEN
        RAISE EXCEPTION 'Incoming employee is not on this team'; END IF;
    END IF;
    UPDATE public.employee_shifts SET
      status = CASE WHEN _action = 'transfer' THEN 'transferred' ELSE 'ended' END,
      ended_at = t,
      break_seconds = break_seconds + CASE WHEN break_started_at IS NOT NULL THEN EXTRACT(EPOCH FROM t - break_started_at)::int ELSE 0 END,
      break_started_at = NULL, handover_to = CASE WHEN _action = 'transfer' THEN _to_user END, note = COALESCE(_note, note), updated_at = t
    WHERE id = s.id;
    IF _action = 'transfer' THEN
      PERFORM public.notify_user(_to_user, _pharmacy, 'info', 'Shift handed over to you', 'Start your shift to accept the handover.', NULL);
    END IF;
  ELSE RAISE EXCEPTION 'Unknown shift action'; END IF;

  INSERT INTO public.shift_events(shift_id, pharmacy_id, actor_id, action, minutes, target_user, note) VALUES (s.id, _pharmacy, uid, _action, _minutes, _to_user, _note);
  RETURN s.id;
END $$;
REVOKE ALL ON FUNCTION public.shift_action(uuid, text, uuid, integer, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shift_action(uuid, text, uuid, integer, uuid, text) TO authenticated;