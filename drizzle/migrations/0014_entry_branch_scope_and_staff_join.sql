CREATE OR REPLACE FUNCTION public.can_access_branch(_pharmacy uuid,_branch uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_platform_admin() OR public.is_pharmacy_owner(_pharmacy) OR EXISTS(SELECT 1 FROM pharmacy_memberships WHERE pharmacy_id=_pharmacy AND user_id=auth.uid() AND is_active AND employment_status<>'inactive' AND ((_branch IS NULL AND branch_id IS NULL AND cardinality(branch_ids)=0) OR (_branch IS NOT NULL AND ((branch_id IS NULL AND cardinality(branch_ids)=0) OR branch_id=_branch OR _branch=ANY(branch_ids))))) $$;
REVOKE ALL ON FUNCTION public.can_access_branch(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_branch(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_branch_mutation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.can_access_branch(NEW.pharmacy_id,NEW.branch_id) THEN
  IF TG_TABLE_NAME='inventory_batches' AND current_setting('app.wholesale_transfer',true)='on' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'You are not assigned to this branch';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER scope_stock_branch BEFORE INSERT OR UPDATE ON public.inventory_batches FOR EACH ROW EXECUTE FUNCTION public.guard_branch_mutation();
CREATE TRIGGER scope_sale_branch BEFORE INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.guard_branch_mutation();
CREATE TRIGGER scope_prescription_branch BEFORE INSERT OR UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.guard_branch_mutation();
DROP POLICY "Batch read" ON public.inventory_batches;
DROP POLICY "Batch write" ON public.inventory_batches;
CREATE POLICY "Batch read" ON public.inventory_batches FOR SELECT TO authenticated USING (public.can_access_branch(pharmacy_id,branch_id));
CREATE POLICY "Batch write" ON public.inventory_batches FOR ALL TO authenticated USING (public.can_write_pharmacy(pharmacy_id,ARRAY['manager','inventory_manager','pharmacist']::user_role[]) AND public.can_access_branch(pharmacy_id,branch_id)) WITH CHECK (public.can_write_pharmacy(pharmacy_id,ARRAY['manager','inventory_manager','pharmacist']::user_role[]) AND public.can_access_branch(pharmacy_id,branch_id));
DROP POLICY "Branch read" ON public.branches;
DROP POLICY "Branch write" ON public.branches;
CREATE POLICY "Branch read" ON public.branches FOR SELECT TO authenticated USING (public.can_access_branch(pharmacy_id,id));
CREATE POLICY "Branch write" ON public.branches FOR ALL TO authenticated USING (public.can_write_pharmacy(pharmacy_id,ARRAY['manager']::user_role[]) AND public.can_access_branch(pharmacy_id,id)) WITH CHECK (public.can_write_pharmacy(pharmacy_id,ARRAY['manager']::user_role[]) AND public.can_access_branch(pharmacy_id,id));
CREATE OR REPLACE FUNCTION public.accept_invitation(_invite_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_inv public.pharmacy_invites%ROWTYPE; v_email text;
BEGIN
 SELECT email INTO v_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 IF v_email IS NULL THEN RAISE EXCEPTION 'Please confirm your email address first'; END IF;
 SELECT * INTO v_inv FROM pharmacy_invites WHERE id=_invite_id AND status='pending' AND lower(email)=lower(v_email) FOR UPDATE;
 IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
 IF NOT pharmacy_is_current(v_inv.pharmacy_id) THEN RAISE EXCEPTION 'This pharmacy account is not active'; END IF;
 UPDATE pharmacy_invites SET status='accepted',accepted_at=now() WHERE id=v_inv.id;
 INSERT INTO pharmacy_memberships(pharmacy_id,user_id,branch_id,branch_ids,role,is_active,phone,staff_id,job_title,employment_status)
 VALUES(v_inv.pharmacy_id,auth.uid(),v_inv.branch_id,v_inv.branch_ids,v_inv.role,true,v_inv.phone,v_inv.staff_id,v_inv.job_title,v_inv.employment_status)
 ON CONFLICT(pharmacy_id,user_id) DO UPDATE SET role=excluded.role,branch_id=excluded.branch_id,branch_ids=excluded.branch_ids,is_active=true,phone=excluded.phone,staff_id=excluded.staff_id,job_title=excluded.job_title,employment_status=excluded.employment_status;
 INSERT INTO audit_logs(pharmacy_id,user_id,action,entity,entity_id) VALUES(v_inv.pharmacy_id,auth.uid(),'invite_accepted','pharmacy_membership',v_inv.id::text);
 RETURN v_inv.pharmacy_id;
END $$;
CREATE OR REPLACE FUNCTION public.guard_business_record_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.pharmacy_id IS DISTINCT FROM OLD.pharmacy_id THEN RAISE EXCEPTION 'Business ownership of a record cannot be changed'; END IF;
 IF TG_TABLE_NAME='branches' AND auth.uid() IS NOT NULL AND NOT public.can_access_branch(NEW.pharmacy_id,CASE WHEN TG_OP='UPDATE' THEN OLD.id ELSE NULL END) THEN RAISE EXCEPTION 'Only business-wide managers can create branches'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER branches_guard_scope BEFORE INSERT OR UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.guard_business_record_scope();
CREATE TRIGGER products_guard_scope BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.guard_business_record_scope();
CREATE TRIGGER suppliers_guard_scope BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.guard_business_record_scope();
CREATE OR REPLACE FUNCTION public.set_wholesale_transfer_context() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN PERFORM set_config('app.wholesale_transfer','on',true); RETURN NEW; END $$;
CREATE TRIGGER wholesale_transfer_context BEFORE UPDATE ON public.wholesale_orders FOR EACH ROW EXECUTE FUNCTION public.set_wholesale_transfer_context();