CREATE POLICY "Pharmacy members read product photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images'
    AND (public.is_platform_admin() OR public.user_belongs_to_pharmacy(public.try_uuid((storage.foldername(name))[1]))));
COMMENT ON COLUMN public.products.image_url IS 'Storage path in the private product-images bucket (<pharmacy id>/<file>)';