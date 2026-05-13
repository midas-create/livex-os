-- =============================================================================
-- LiveX Supply — Schema v4 (Brand + Image Storage)
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- 1. Add brand column to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand TEXT;

-- =============================================================================
-- IMPORTANT: Supabase Storage Setup (do this in the Supabase Dashboard)
-- =============================================================================
-- 1. Go to: Storage → Create new bucket
--    Name: product-images
--    Public: YES (toggle on)
--
-- 2. Add these RLS policies on the bucket:
--    SELECT (read): allow all authenticated users
--    INSERT (upload): allow only admin users
--
-- Or run these via Supabase's storage policies:
-- =============================================================================

-- Storage RLS policies (run via Storage section in Supabase, NOT here)
-- These are for documentation:
--
-- CREATE POLICY "Public read product images"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'product-images');
--
-- CREATE POLICY "Admin upload product images"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'product-images' AND
--   EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
-- );
--
-- CREATE POLICY "Admin delete product images"
-- ON storage.objects FOR DELETE
-- USING (
--   bucket_id = 'product-images' AND
--   EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
-- );
