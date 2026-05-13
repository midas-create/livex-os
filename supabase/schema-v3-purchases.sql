-- =============================================================================
-- LiveX Supply — Schema v3 (Purchases + Delivery fix)
-- Run this in your Supabase SQL Editor AFTER schema-v2-migration.sql
-- =============================================================================

-- 1. Add delivery_address + expected_delivery_date to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address       TEXT,
  ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;

-- 2. Purchases table (multi-line supplier entries)
CREATE TABLE IF NOT EXISTS public.purchases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_name   TEXT NOT NULL,
  purchase_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  payment_status  TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Purchase items (lines)
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id   UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id),
  quantity      INT NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price   NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Add purchase_ref to stock_movements if not exists
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL;

-- 5. RLS for purchases
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchases_admin_all" ON public.purchases;
CREATE POLICY "purchases_admin_all" ON public.purchases
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "purchase_items_admin_all" ON public.purchase_items;
CREATE POLICY "purchase_items_admin_all" ON public.purchase_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 6. Update stock_movements source to include 'delivery' for clarity
--    (keeping 'sale' compatible but adding 'delivery' as valid source)
ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_source_check;
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_source_check
  CHECK (source IN ('purchase', 'sale', 'adjustment', 'delivery'));
