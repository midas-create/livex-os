-- =============================================================================
-- LiveX — Stock entreprise client (B2B)
-- Tables demandées : équivalent "stocks" + "stock_movements" par société.
-- Noms : client_stocks / client_stock_movements (évite collision avec stock_movements entrepôt)
-- Exécuter dans le SQL Editor Supabase après les migrations précédentes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_stocks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  current_stock   INT NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_threshold   INT NOT NULL DEFAULT 5 CHECK (min_threshold >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.client_stock_movements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  quantity        INT NOT NULL CHECK (quantity > 0),
  source          TEXT NOT NULL CHECK (source IN ('DELIVERY', 'MANUAL')),
  order_id        UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_stocks_company_idx ON public.client_stocks(company_id);
CREATE INDEX IF NOT EXISTS client_stock_movements_company_idx ON public.client_stock_movements(company_id);
CREATE INDEX IF NOT EXISTS client_stock_movements_order_idx ON public.client_stock_movements(order_id)
  WHERE order_id IS NOT NULL;

ALTER TABLE public.client_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_stock_movements ENABLE ROW LEVEL SECURITY;

-- Clients : lecture / mise à jour seuils sur leur société
DROP POLICY IF EXISTS "client_stocks_select_own" ON public.client_stocks;
CREATE POLICY "client_stocks_select_own" ON public.client_stocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id = client_stocks.company_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_stocks_update_own" ON public.client_stocks;
CREATE POLICY "client_stocks_update_own" ON public.client_stocks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id = client_stocks.company_id AND cp.user_id = auth.uid()
    )
  );

-- Admins : tout (livraisons = entrées stock client)
DROP POLICY IF EXISTS "client_stocks_admin_all" ON public.client_stocks;
CREATE POLICY "client_stocks_admin_all" ON public.client_stocks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Mouvements : lecture client + admin
DROP POLICY IF EXISTS "client_stock_movements_select" ON public.client_stock_movements;
CREATE POLICY "client_stock_movements_select" ON public.client_stock_movements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id = client_stock_movements.company_id AND cp.user_id = auth.uid()
    )
  );

-- Client : sortie manuelle uniquement
DROP POLICY IF EXISTS "client_stock_movements_insert_manual" ON public.client_stock_movements;
CREATE POLICY "client_stock_movements_insert_manual" ON public.client_stock_movements
  FOR INSERT WITH CHECK (
    type = 'OUT' AND source = 'MANUAL'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id = client_stock_movements.company_id AND cp.user_id = auth.uid()
    )
  );

-- Admin : entrées livraison (et maintenance si besoin)
DROP POLICY IF EXISTS "client_stock_movements_insert_admin" ON public.client_stock_movements;
CREATE POLICY "client_stock_movements_insert_admin" ON public.client_stock_movements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Admins peuvent aussi insérer des lignes "système" si policies multiples : OK (OR des WITH CHECK)
