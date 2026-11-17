CREATE OR REPLACE FUNCTION public.validate_entry_required_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_TABLE_NAME='products' THEN
  IF NEW.selling_price IS NULL OR NEW.name IS NULL THEN RAISE EXCEPTION 'Product name and selling price are required'; END IF;
 ELSIF TG_TABLE_NAME='categories' THEN
  IF EXISTS(SELECT 1 FROM categories WHERE pharmacy_id=NEW.pharmacy_id AND (lower(slug)=lower(NEW.slug) OR lower(name)=lower(NEW.name)) AND id<>NEW.id) THEN RAISE EXCEPTION 'Duplicate category name or code'; END IF;
 ELSIF TG_TABLE_NAME='pharmacy_invites' THEN
  IF EXISTS(SELECT 1 FROM pharmacy_memberships m JOIN profiles p ON p.id=m.user_id WHERE m.pharmacy_id=NEW.pharmacy_id AND lower(p.email)=lower(NEW.email) AND m.is_active) THEN RAISE EXCEPTION 'Staff member already belongs to this business'; END IF;
 END IF;
 RETURN NEW;
END $$;