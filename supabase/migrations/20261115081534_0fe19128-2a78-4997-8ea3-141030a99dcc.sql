CREATE OR REPLACE FUNCTION public.platform_demand_trends(_supplier uuid)
RETURNS TABLE(product text, strength text, units_90d bigint, units_30d bigint, units_prev_30d bigint, pharmacies bigint, your_stock bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM pharmacies p WHERE p.id = _supplier AND p.business_type = 'supplier'
      AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM pharmacy_memberships m WHERE m.pharmacy_id = p.id AND m.user_id = auth.uid() AND m.is_active)))) THEN
    RAISE EXCEPTION 'Only suppliers can view platform demand';
  END IF;
  RETURN QUERY
  WITH s AS (
    SELECT lower(trim(coalesce(nullif(pr.generic_name,''), pr.name))) AS k,
           max(coalesce(nullif(pr.generic_name,''), pr.name)) OVER (PARTITION BY lower(trim(coalesce(nullif(pr.generic_name,''), pr.name)))) AS label,
           coalesce(pr.strength,'') AS st, si.quantity, sa.created_at, sa.pharmacy_id
    FROM sale_items si JOIN sales sa ON sa.id = si.sale_id JOIN products pr ON pr.id = si.product_id
    JOIN pharmacies ph ON ph.id = sa.pharmacy_id AND ph.business_type = 'pharmacy'
    WHERE sa.created_at >= now() - interval '90 days'
  ), agg AS (
    SELECT k, max(label) AS label, max(st) AS st,
      sum(quantity)::bigint AS u90,
      sum(quantity) FILTER (WHERE created_at >= now() - interval '30 days')::bigint AS u30,
      sum(quantity) FILTER (WHERE created_at < now() - interval '30 days' AND created_at >= now() - interval '60 days')::bigint AS up,
      count(DISTINCT pharmacy_id)::bigint AS n
    FROM s GROUP BY k
  )
  SELECT a.label, a.st, a.u90, coalesce(a.u30,0), coalesce(a.up,0), a.n,
    coalesce((SELECT sum(b.quantity) FROM inventory_batches b JOIN products p2 ON p2.id = b.product_id
      WHERE b.pharmacy_id = _supplier AND b.expiry_date > current_date
        AND lower(trim(coalesce(nullif(p2.generic_name,''), p2.name))) = a.k),0)::bigint
  FROM agg a WHERE a.n >= 2
  ORDER BY a.u30 DESC NULLS LAST, a.u90 DESC LIMIT 50;
END $$;
REVOKE ALL ON FUNCTION public.platform_demand_trends(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_demand_trends(uuid) TO authenticated;