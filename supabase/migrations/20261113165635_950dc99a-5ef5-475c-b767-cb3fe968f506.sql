ALTER TABLE public.pharmacies DISABLE TRIGGER pharmacies_guard_billing;
UPDATE public.pharmacies SET business_type='supplier' WHERE id='7df2d4e7-df3d-48ad-8a7c-381315edc574';
ALTER TABLE public.pharmacies ENABLE TRIGGER pharmacies_guard_billing;
CREATE OR REPLACE FUNCTION public.admin_register_business(_payload jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE p uuid; v uuid; t text := CASE WHEN _payload->>'business_type'='supplier' THEN 'supplier' ELSE 'pharmacy' END;
BEGIN IF NOT is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
SELECT id INTO p FROM subscription_plans WHERE slug=_payload->>'plan_slug' AND is_active IS NOT FALSE;
IF p IS NULL OR trim(coalesce(_payload->>'business_name',''))='' THEN RAISE EXCEPTION 'Business name and plan are required'; END IF;
INSERT INTO pharmacies(name,business_type,owner_name,email,phone,city,address,registration_number,tax_number,plan_id,billing_choice,status)
VALUES(_payload->>'business_name',t,_payload->>'owner_name',_payload->>'email',_payload->>'phone',_payload->>'city',_payload->>'address',_payload->>'registration_number',_payload->>'tax_number',p,'trial','pending') RETURNING id INTO v;
INSERT INTO audit_logs(pharmacy_id,user_id,action,entity,entity_id) VALUES(v,auth.uid(),'registration_submitted','pharmacy',v::text);
RETURN v; END $function$;