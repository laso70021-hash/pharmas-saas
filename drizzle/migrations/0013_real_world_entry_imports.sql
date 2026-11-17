ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_name text, ADD COLUMN IF NOT EXISTS description text, ADD COLUMN IF NOT EXISTS unit_of_measurement text DEFAULT 'unit', ADD COLUMN IF NOT EXISTS packaging text, ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS manufacturing_date date;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.pharmacy_invites ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS staff_id text, ADD COLUMN IF NOT EXISTS job_title text, ADD COLUMN IF NOT EXISTS employment_status text DEFAULT 'active', ADD COLUMN IF NOT EXISTS branch_ids uuid[] DEFAULT '{}';
ALTER TABLE public.pharmacy_memberships ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS staff_id text, ADD COLUMN IF NOT EXISTS job_title text, ADD COLUMN IF NOT EXISTS employment_status text DEFAULT 'active', ADD COLUMN IF NOT EXISTS branch_ids uuid[] DEFAULT '{}';
CREATE TABLE public.import_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id), created_by uuid NOT NULL, module text NOT NULL, fingerprint text NOT NULL, file_name text NOT NULL, successful_count integer NOT NULL DEFAULT 0, failed_count integer NOT NULL DEFAULT 0, status text NOT NULL, error_message text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(pharmacy_id,module,fingerprint));
GRANT SELECT ON public.import_history TO authenticated;
GRANT ALL ON public.import_history TO service_role;
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_history_read ON public.import_history FOR SELECT TO authenticated USING (public.is_platform_admin() OR public.has_pharmacy_role(pharmacy_id,ARRAY['manager','inventory_manager']::public.user_role[]));
CREATE OR REPLACE FUNCTION public.validate_business_entry() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE b uuid;
BEGIN
 IF TG_TABLE_NAME='products' THEN
  IF trim(NEW.name)='' OR NEW.selling_price<0 OR coalesce(NEW.cost_price,0)<0 OR coalesce(NEW.min_stock_level,0)<0 THEN RAISE EXCEPTION 'Invalid product name, price or reorder level'; END IF;
  IF NEW.sku IS NOT NULL AND NEW.sku<>'' AND EXISTS(SELECT 1 FROM products WHERE pharmacy_id=NEW.pharmacy_id AND lower(sku)=lower(NEW.sku) AND id<>NEW.id) THEN RAISE EXCEPTION 'Duplicate product SKU: %',NEW.sku; END IF;
  IF NEW.category_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM categories WHERE id=NEW.category_id AND pharmacy_id=NEW.pharmacy_id) THEN RAISE EXCEPTION 'Category must belong to this business'; END IF;
  IF NEW.supplier_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM suppliers WHERE id=NEW.supplier_id AND pharmacy_id=NEW.pharmacy_id) THEN RAISE EXCEPTION 'Supplier must belong to this business'; END IF;
 ELSIF TG_TABLE_NAME='inventory_batches' THEN
  IF NEW.quantity<0 OR coalesce(NEW.cost_per_unit,0)<0 OR trim(NEW.batch_number)='' THEN RAISE EXCEPTION 'Invalid batch number, quantity or cost'; END IF;
  IF NEW.manufacturing_date IS NOT NULL AND NEW.manufacturing_date>NEW.expiry_date THEN RAISE EXCEPTION 'Manufacturing date must not be after expiry date'; END IF;
  IF NOT EXISTS(SELECT 1 FROM products WHERE id=NEW.product_id AND pharmacy_id=NEW.pharmacy_id) THEN RAISE EXCEPTION 'Product must belong to this business'; END IF;
  IF NEW.branch_id IS NULL OR NOT EXISTS(SELECT 1 FROM branches WHERE id=NEW.branch_id AND pharmacy_id=NEW.pharmacy_id) THEN RAISE EXCEPTION 'Choose a branch belonging to this business'; END IF;
  IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM inventory_batches WHERE pharmacy_id=NEW.pharmacy_id AND product_id=NEW.product_id AND branch_id=NEW.branch_id AND lower(batch_number)=lower(NEW.batch_number) AND expiry_date IS DISTINCT FROM NEW.expiry_date) THEN RAISE EXCEPTION 'Batch number already exists with a different expiry date'; END IF;
 ELSIF TG_TABLE_NAME='branches' THEN
  IF trim(NEW.name)='' THEN RAISE EXCEPTION 'Branch name is required'; END IF;
  IF NEW.code IS NOT NULL AND EXISTS(SELECT 1 FROM branches WHERE pharmacy_id=NEW.pharmacy_id AND lower(code)=lower(NEW.code) AND id<>NEW.id) THEN RAISE EXCEPTION 'Duplicate branch code'; END IF;
  IF NEW.manager_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pharmacy_memberships WHERE pharmacy_id=NEW.pharmacy_id AND user_id=NEW.manager_id AND role='manager' AND is_active) THEN RAISE EXCEPTION 'Select an active manager from this business'; END IF;
 ELSIF TG_TABLE_NAME IN ('pharmacy_invites','pharmacy_memberships') THEN
  IF NEW.role NOT IN ('manager','pharmacist','cashier','accountant','inventory_manager','delivery_rider') THEN RAISE EXCEPTION 'Only staff roles are allowed'; END IF;
  IF NEW.employment_status NOT IN ('active','on_leave','inactive') THEN RAISE EXCEPTION 'Invalid employment status'; END IF;
  IF NEW.branch_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branches WHERE id=NEW.branch_id AND pharmacy_id=NEW.pharmacy_id) THEN RAISE EXCEPTION 'Branch must belong to this business'; END IF;
  FOREACH b IN ARRAY coalesce(NEW.branch_ids,'{}') LOOP
   IF NOT EXISTS(SELECT 1 FROM branches WHERE id=b AND pharmacy_id=NEW.pharmacy_id) THEN RAISE EXCEPTION 'Assigned branches must belong to this business'; END IF;
  END LOOP;
  IF TG_TABLE_NAME='pharmacy_invites' THEN
   IF NEW.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid staff email'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER products_validate_entry BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.validate_business_entry();
CREATE TRIGGER batches_validate_entry BEFORE INSERT OR UPDATE ON public.inventory_batches FOR EACH ROW EXECUTE FUNCTION public.validate_business_entry();
CREATE TRIGGER branches_validate_entry BEFORE INSERT OR UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.validate_business_entry();
CREATE TRIGGER invites_validate_entry BEFORE INSERT OR UPDATE ON public.pharmacy_invites FOR EACH ROW EXECUTE FUNCTION public.validate_business_entry();
CREATE TRIGGER memberships_validate_entry BEFORE INSERT OR UPDATE ON public.pharmacy_memberships FOR EACH ROW EXECUTE FUNCTION public.validate_business_entry();
CREATE OR REPLACE FUNCTION public.save_business_entry(_pharmacy uuid,_module text,_row jsonb,_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_product uuid; v_branch uuid; v_category uuid; v_supplier uuid; v_branches uuid[]:='{}'; v text;
BEGIN
 PERFORM 1 FROM pharmacies WHERE id=_pharmacy FOR UPDATE;
 IF _module IN ('staff','settings') THEN
  IF NOT public.can_write_pharmacy(_pharmacy,ARRAY[]::user_role[]) THEN RAISE EXCEPTION 'Only the owner or administrator can manage staff and business settings'; END IF;
 ELSIF _module='branches' THEN
  IF NOT public.can_write_pharmacy(_pharmacy,ARRAY['manager']::user_role[]) THEN RAISE EXCEPTION 'Branch management is not permitted'; END IF;
 ELSE
  IF NOT public.can_write_pharmacy(_pharmacy,ARRAY['manager','inventory_manager','pharmacist']::user_role[]) THEN RAISE EXCEPTION 'Stock management is not permitted'; END IF;
 END IF;
 IF _module='products' THEN
  IF nullif(_row->>'category_name','') IS NOT NULL THEN
   SELECT id INTO v_category FROM categories WHERE pharmacy_id=_pharmacy AND lower(name)=lower(_row->>'category_name');
   IF v_category IS NULL OR (SELECT count(*) FROM categories WHERE pharmacy_id=_pharmacy AND lower(name)=lower(_row->>'category_name'))<>1 THEN RAISE EXCEPTION 'Unknown or ambiguous category_name'; END IF;
  END IF;
  IF nullif(_row->>'supplier_name','') IS NOT NULL THEN
   SELECT id INTO v_supplier FROM suppliers WHERE pharmacy_id=_pharmacy AND lower(name)=lower(_row->>'supplier_name');
   IF v_supplier IS NULL OR (SELECT count(*) FROM suppliers WHERE pharmacy_id=_pharmacy AND lower(name)=lower(_row->>'supplier_name'))<>1 THEN RAISE EXCEPTION 'Unknown or ambiguous supplier_name'; END IF;
  END IF;
  IF _id IS NULL THEN
   INSERT INTO products(pharmacy_id,name,generic_name,brand_name,description,sku,barcode,dosage_form,strength,unit_of_measurement,packaging,cost_price,selling_price,min_stock_level,is_prescription_required,category_id,supplier_id,is_active)
   VALUES(_pharmacy,_row->>'name',_row->>'generic_name',_row->>'brand_name',_row->>'description',nullif(_row->>'sku',''),_row->>'barcode',_row->>'dosage_form',_row->>'strength',_row->>'unit_of_measurement',_row->>'packaging',coalesce(nullif(_row->>'cost_price','')::numeric,0),(_row->>'selling_price')::numeric,coalesce(nullif(_row->>'min_stock_level','')::integer,0),coalesce(nullif(_row->>'is_prescription_required','')::boolean,false),v_category,v_supplier,coalesce(nullif(_row->>'is_active','')::boolean,true)) RETURNING id INTO v_id;
  ELSE
   UPDATE products SET name=_row->>'name',generic_name=_row->>'generic_name',brand_name=_row->>'brand_name',description=_row->>'description',sku=nullif(_row->>'sku',''),barcode=_row->>'barcode',dosage_form=_row->>'dosage_form',strength=_row->>'strength',unit_of_measurement=_row->>'unit_of_measurement',packaging=_row->>'packaging',cost_price=coalesce(nullif(_row->>'cost_price','')::numeric,0),selling_price=(_row->>'selling_price')::numeric,min_stock_level=coalesce(nullif(_row->>'min_stock_level','')::int,0),is_prescription_required=coalesce(nullif(_row->>'is_prescription_required','')::boolean,false),category_id=v_category,supplier_id=v_supplier,is_active=coalesce(nullif(_row->>'is_active','')::boolean,true),updated_at=now() WHERE id=_id AND pharmacy_id=_pharmacy RETURNING id INTO v_id;
  END IF;
 ELSIF _module='batches' THEN
  SELECT id INTO v_product FROM products WHERE pharmacy_id=_pharmacy AND lower(sku)=lower(_row->>'product_sku');
  SELECT id INTO v_branch FROM branches WHERE pharmacy_id=_pharmacy AND lower(code)=lower(_row->>'branch_code') AND is_active IS NOT FALSE;
  IF v_product IS NULL THEN RAISE EXCEPTION 'Unknown product_sku'; END IF;
  IF v_branch IS NULL THEN RAISE EXCEPTION 'Unknown or closed branch_code'; END IF;
  IF _id IS NOT NULL THEN RAISE EXCEPTION 'Use audited stock correction to change quantities'; END IF;
  IF EXISTS(SELECT 1 FROM inventory_batches WHERE pharmacy_id=_pharmacy AND product_id=v_product AND branch_id=v_branch AND lower(batch_number)=lower(_row->>'batch_number')) THEN RAISE EXCEPTION 'Batch already exists; use stock correction'; END IF;
  INSERT INTO inventory_batches(pharmacy_id,product_id,branch_id,batch_number,quantity,cost_per_unit,manufacturing_date,expiry_date,received_date) VALUES(_pharmacy,v_product,v_branch,_row->>'batch_number',(_row->>'quantity')::int,coalesce(nullif(_row->>'cost_per_unit','')::numeric,0),nullif(_row->>'manufacturing_date','')::date,(_row->>'expiry_date')::date,coalesce(nullif(_row->>'received_date','')::date,current_date)) RETURNING id INTO v_id;
  INSERT INTO stock_movements(pharmacy_id,product_id,batch_id,movement_type,quantity,notes,created_by) VALUES(_pharmacy,v_product,v_id,'stock_in',(_row->>'quantity')::int,'Opening stock / batch receipt',auth.uid());
 ELSIF _module='branches' THEN
  IF _id IS NULL THEN
   INSERT INTO branches(pharmacy_id,name,code,address,phone,is_main,is_active,manager_id) VALUES(_pharmacy,_row->>'name',nullif(_row->>'code',''),_row->>'address',_row->>'phone',false,coalesce(nullif(_row->>'is_active','')::boolean,true),nullif(_row->>'manager_id','')::uuid) RETURNING id INTO v_id;
  ELSE
   UPDATE branches SET name=_row->>'name',code=nullif(_row->>'code',''),address=_row->>'address',phone=_row->>'phone',is_active=coalesce(nullif(_row->>'is_active','')::boolean,true),manager_id=nullif(_row->>'manager_id','')::uuid,updated_at=now() WHERE id=_id AND pharmacy_id=_pharmacy RETURNING id INTO v_id;
  END IF;
  IF coalesce(nullif(_row->>'is_main','')::boolean,false) THEN
   UPDATE branches SET is_main=false WHERE pharmacy_id=_pharmacy AND id<>v_id;
   UPDATE branches SET is_main=true,is_active=true WHERE id=v_id;
  END IF;
 ELSIF _module='suppliers' THEN
  IF trim(coalesce(_row->>'name',''))='' THEN RAISE EXCEPTION 'Supplier name is required'; END IF;
  IF EXISTS(SELECT 1 FROM suppliers WHERE pharmacy_id=_pharmacy AND lower(name)=lower(_row->>'name') AND id IS DISTINCT FROM _id) THEN RAISE EXCEPTION 'Duplicate supplier name'; END IF;
  IF _id IS NULL THEN
   INSERT INTO suppliers(pharmacy_id,name,contact_name,email,phone,address,tax_id,is_active) VALUES(_pharmacy,_row->>'name',_row->>'contact_name',_row->>'email',_row->>'phone',_row->>'address',_row->>'tax_id',coalesce(nullif(_row->>'is_active','')::boolean,true)) RETURNING id INTO v_id;
  ELSE
   UPDATE suppliers SET name=_row->>'name',contact_name=_row->>'contact_name',email=_row->>'email',phone=_row->>'phone',address=_row->>'address',tax_id=_row->>'tax_id',is_active=coalesce(nullif(_row->>'is_active','')::boolean,true) WHERE id=_id AND pharmacy_id=_pharmacy RETURNING id INTO v_id;
  END IF;
 ELSIF _module='categories' THEN
  IF trim(coalesce(_row->>'name',''))='' OR trim(coalesce(_row->>'slug',''))='' THEN RAISE EXCEPTION 'Category name and slug are required'; END IF;
  IF _id IS NULL THEN
   INSERT INTO categories(pharmacy_id,name,slug,description,is_active) VALUES(_pharmacy,_row->>'name',_row->>'slug',_row->>'description',coalesce(nullif(_row->>'is_active','')::boolean,true)) RETURNING id INTO v_id;
  ELSE
   UPDATE categories SET name=_row->>'name',slug=_row->>'slug',description=_row->>'description',is_active=coalesce(nullif(_row->>'is_active','')::boolean,true) WHERE id=_id AND pharmacy_id=_pharmacy RETURNING id INTO v_id;
  END IF;
 ELSIF _module='staff' THEN
  IF _id IS NOT NULL THEN RAISE EXCEPTION 'Use staff management to update joined staff'; END IF;
  IF nullif(_row->>'branch_codes','') IS NOT NULL THEN
   FOR v IN SELECT trim(x) FROM unnest(string_to_array(_row->>'branch_codes',';')) x LOOP
    SELECT id INTO v_branch FROM branches WHERE pharmacy_id=_pharmacy AND lower(code)=lower(v);
    IF v_branch IS NULL THEN RAISE EXCEPTION 'Unknown branch code: %',v; END IF;
    v_branches:=array_append(v_branches,v_branch);
   END LOOP;
  END IF;
  INSERT INTO pharmacy_invites(pharmacy_id,email,full_name,phone,staff_id,job_title,role,employment_status,branch_id,branch_ids,invited_by) VALUES(_pharmacy,lower(trim(_row->>'email')),_row->>'full_name',_row->>'phone',_row->>'staff_id',_row->>'job_title',(_row->>'role')::user_role,coalesce(nullif(_row->>'employment_status',''),'active'),CASE WHEN cardinality(v_branches)=1 THEN v_branches[1] ELSE NULL END,v_branches,auth.uid()) RETURNING id INTO v_id;
 ELSIF _module='settings' THEN
  UPDATE pharmacies SET name=_row->>'name',registration_number=_row->>'registration_number',tax_number=_row->>'tax_number',email=_row->>'email',phone=_row->>'phone',address=_row->>'address',city=_row->>'city',country=_row->>'country',owner_name=_row->>'owner_name',updated_at=now() WHERE id=_pharmacy RETURNING id INTO v_id;
 ELSE RAISE EXCEPTION 'Unsupported entry module';
 END IF;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Record not found in this business'; END IF;
 INSERT INTO audit_logs(pharmacy_id,user_id,action,entity,entity_id) VALUES(_pharmacy,auth.uid(),CASE WHEN _id IS NULL THEN 'created' ELSE 'updated' END,_module,v_id::text);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.save_business_entry(uuid,text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_business_entry(uuid,text,jsonb,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.import_business_rows(_pharmacy uuid,_module text,_rows jsonb,_fingerprint text,_file_name text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb; n int:=0; message text;
BEGIN
 IF NOT public.can_write_pharmacy(_pharmacy,CASE WHEN _module='staff' THEN ARRAY[]::user_role[] WHEN _module='branches' THEN ARRAY['manager']::user_role[] ELSE ARRAY['manager','inventory_manager','pharmacist']::user_role[] END) THEN RAISE EXCEPTION 'Import is not permitted'; END IF;
 IF _module NOT IN ('products','batches','branches','suppliers','categories','staff') THEN RAISE EXCEPTION 'Unsupported import module'; END IF;
 IF jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows)<1 OR jsonb_array_length(_rows)>5000 THEN RAISE EXCEPTION 'Import between 1 and 5000 rows at a time'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_pharmacy::text||_module||_fingerprint,0));
 IF EXISTS(SELECT 1 FROM import_history WHERE pharmacy_id=_pharmacy AND module=_module AND fingerprint=_fingerprint) THEN RAISE EXCEPTION 'This file was already processed; review import history before retrying'; END IF;
 BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
   n:=n+1;
   PERFORM public.save_business_entry(_pharmacy,_module,r,NULL);
  END LOOP;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
  INSERT INTO import_history(pharmacy_id,created_by,module,fingerprint,file_name,failed_count,status,error_message) VALUES(_pharmacy,auth.uid(),_module,_fingerprint,left(_file_name,200),jsonb_array_length(_rows),'failed','Row '||n||': '||message);
  RETURN jsonb_build_object('status','failed','successful_count',0,'failed_count',jsonb_array_length(_rows),'error','Row '||n||': '||message);
 END;
 INSERT INTO import_history(pharmacy_id,created_by,module,fingerprint,file_name,successful_count,status) VALUES(_pharmacy,auth.uid(),_module,_fingerprint,left(_file_name,200),n,'completed');
 RETURN jsonb_build_object('status','completed','successful_count',n,'failed_count',0);
END $$;
REVOKE ALL ON FUNCTION public.import_business_rows(uuid,text,jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_business_rows(uuid,text,jsonb,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.correct_batch_stock(_pharmacy uuid,_batch uuid,_quantity int,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b inventory_batches%ROWTYPE;
BEGIN
 IF NOT public.can_write_pharmacy(_pharmacy,ARRAY['manager','inventory_manager','pharmacist']::user_role[]) THEN RAISE EXCEPTION 'Stock correction is not permitted'; END IF;
 IF _quantity<0 OR trim(coalesce(_reason,''))='' THEN RAISE EXCEPTION 'Non-negative quantity and a reason are required'; END IF;
 SELECT * INTO b FROM inventory_batches WHERE id=_batch AND pharmacy_id=_pharmacy FOR UPDATE;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Batch not found'; END IF;
 UPDATE inventory_batches SET quantity=_quantity,updated_at=now() WHERE id=_batch;
 INSERT INTO stock_movements(pharmacy_id,product_id,batch_id,movement_type,quantity,notes,created_by) VALUES(_pharmacy,b.product_id,_batch,'adjustment',_quantity-b.quantity,_reason,auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.correct_batch_stock(uuid,uuid,int,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.correct_batch_stock(uuid,uuid,int,text) TO authenticated;