REVOKE ALL ON FUNCTION public.guard_report_plan() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_delivery_plan() FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.pharmacy_has_plan_feature(uuid,text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.platform_demand_trends_internal(uuid) FROM PUBLIC,anon,authenticated;