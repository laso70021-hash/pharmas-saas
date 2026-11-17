CREATE OR REPLACE FUNCTION public.pharmacy_has_plan_feature(_pharmacy_id uuid, _feature text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT public.is_platform_admin() OR EXISTS (
 SELECT 1 FROM public.pharmacies p JOIN public.subscription_plans s ON s.id=p.plan_id
 WHERE p.id=_pharmacy_id AND public.user_belongs_to_pharmacy(p.id) AND public.pharmacy_is_current(p.id)
 AND CASE _feature WHEN 'ai' THEN s.has_ai_insights WHEN 'prescription' THEN s.has_prescription_stt_ttt WHEN 'forecasting' THEN s.has_advanced_ai_forecasting WHEN 'import_ai' THEN s.has_bulk_import_ocr WHEN 'delivery' THEN s.has_delivery_management ELSE false END);
$$;
REVOKE ALL ON FUNCTION public.pharmacy_has_plan_feature(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pharmacy_has_plan_feature(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_report_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.enabled AND (TG_OP='INSERT' OR NEW.enabled IS DISTINCT FROM OLD.enabled OR NEW.recipient_ids IS DISTINCT FROM OLD.recipient_ids OR NEW.topics IS DISTINCT FROM OLD.topics OR NEW.language IS DISTINCT FROM OLD.language OR NEW.delivery_hour IS DISTINCT FROM OLD.delivery_hour) AND NOT public.pharmacy_has_plan_feature(NEW.pharmacy_id,'ai') THEN RAISE EXCEPTION 'AI reports require an eligible plan and current subscription'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enforce_report_plan BEFORE INSERT OR UPDATE ON public.ai_report_preferences FOR EACH ROW EXECUTE FUNCTION public.guard_report_plan();
ALTER FUNCTION public.platform_demand_trends(uuid) RENAME TO platform_demand_trends_internal;
REVOKE ALL ON FUNCTION public.platform_demand_trends_internal(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.platform_demand_trends(_supplier uuid)
RETURNS TABLE(product text,strength text,units_90d bigint,units_30d bigint,units_prev_30d bigint,pharmacies bigint,your_stock bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.pharmacy_has_plan_feature(_supplier,'forecasting') THEN RAISE EXCEPTION 'Market demand forecasting requires an eligible plan and current subscription'; END IF;
 RETURN QUERY SELECT * FROM public.platform_demand_trends_internal(_supplier);
END $$;
REVOKE ALL ON FUNCTION public.platform_demand_trends(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_demand_trends(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_delivery_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('preparing','dispatched','in_transit','delivered') AND NOT public.pharmacy_has_plan_feature(NEW.supplier_id,'delivery') THEN RAISE EXCEPTION 'Delivery management requires an eligible supplier plan and current subscription'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enforce_delivery_plan BEFORE UPDATE ON public.wholesale_orders FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_plan();