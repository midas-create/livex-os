-- =============================================================================
-- LiveX Supply — Schema v2 (ERP Upgrade)
-- Run this AFTER schema.sql (or run the full schema-v2-full.sql standalone)
-- =============================================================================

-- 1. Extend products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price   NUMERIC(10,2) GENERATED ALWAYS AS (price) STORED;

-- 2. Extend orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee   NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_paid        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS validated_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_date  DATE,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE;

-- Update existing status check constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'validated', 'to_deliver', 'delivered'));

-- 3. Extend order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED;

-- 4. New: stock_movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  quantity     INT NOT NULL,
  source       TEXT NOT NULL CHECK (source IN ('purchase', 'sale', 'adjustment')),
  reference_id UUID,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. New: payments
CREATE TABLE IF NOT EXISTS public.payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id       UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount         NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank', 'mobile_money')),
  payment_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_select_auth" ON public.stock_movements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "stock_movements_write_admin" ON public.stock_movements
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_id
      AND (orders.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
      ))
    )
  );

CREATE POLICY "payments_write_admin" ON public.payments
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Invoice number sequence
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('invoice_seq')::TEXT, 5, '0');
END;
$$;

-- Auto-set invoice number + validated_at on validation
CREATE OR REPLACE FUNCTION public.handle_order_validated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'validated' AND OLD.status != 'validated' THEN
    IF NEW.invoice_number IS NULL THEN
      NEW.invoice_number := public.generate_invoice_number();
    END IF;
    IF NEW.validated_at IS NULL THEN
      NEW.validated_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_validated ON public.orders;
CREATE TRIGGER on_order_validated
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.handle_order_validated();

-- Delivery fee config (stored as a simple settings table)
CREATE TABLE IF NOT EXISTS public.settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO public.settings (key, value) VALUES
  ('delivery_fee_amount',    '5.00'),
  ('delivery_fee_threshold', '50.00')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_auth" ON public.settings
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "settings_write_admin" ON public.settings
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));
