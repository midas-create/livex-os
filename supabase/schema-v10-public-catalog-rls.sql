-- =============================================================================
-- LiveX Supply — Public catalog read (anonymous + authenticated)
-- Run in Supabase SQL Editor on existing projects.
-- Allows browsing products, categories, and subcategories without login.
-- Does NOT grant INSERT/UPDATE/DELETE to anon (writes stay admin/client-only).
-- =============================================================================

-- Categories: keep existing "authenticated only" policy if present; add public read
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read" ON public.categories
  FOR SELECT
  USING (true);

-- Subcategories
DROP POLICY IF EXISTS "subcategories_public_read" ON public.subcategories;
CREATE POLICY "subcategories_public_read" ON public.subcategories
  FOR SELECT
  USING (true);

-- Products
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
  FOR SELECT
  USING (true);
