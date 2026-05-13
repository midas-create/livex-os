-- =============================================================================
-- LiveX Supply — Schema v5 (Product variants by color)
-- Run in Supabase SQL Editor AFTER schema-v4-brand.sql (or v3 if no v4)
-- Does NOT remove products.stock_quantity (backward compatible)
-- =============================================================================

-- 1. Product variants (stock per color)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color           TEXT NOT NULL,
  stock_quantity  INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, color)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);

-- 2. Order line → variant (optional: NULL = legacy line on product stock only)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON public.order_items(variant_id);

-- 3. Purchase line → variant (optional)
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- 4. RLS product_variants
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_variants_select_all" ON public.product_variants;
CREATE POLICY "product_variants_select_all" ON public.product_variants
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "product_variants_admin_all" ON public.product_variants;
CREATE POLICY "product_variants_admin_all" ON public.product_variants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
