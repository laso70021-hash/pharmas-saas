CREATE OR REPLACE FUNCTION public.guard_business_delivery_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.pharmacy_has_plan_feature(NEW.pharmacy_id,'delivery') THEN RAISE EXCEPTION 'Delivery management requires an eligible plan and current subscription'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_business_delivery_plan() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_business_delivery_plan BEFORE INSERT OR UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.guard_business_delivery_plan();