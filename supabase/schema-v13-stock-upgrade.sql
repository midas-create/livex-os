-- =============================================================================
-- LiveX — v13 : Socle stock (variantes, réservation, livraisons partielles, numérotation)
-- Exécuter dans le SQL Editor Supabase APRÈS les migrations v1–v12.
-- =============================================================================

-- ── 1. Table de séquences de numérotation ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.document_sequences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (document_type IN ('BC', 'BL', 'FA')),
  year          INT  NOT NULL,
  last_number   INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_type, year)
);

-- Fonction atomique de génération de numéro (transactionnelle grâce au INSERT ON CONFLICT)
CREATE OR REPLACE FUNCTION public.next_document_number(p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM NOW())::INT;
  v_next INT;
BEGIN
  INSERT INTO public.document_sequences (document_type, year, last_number)
  VALUES (p_type, v_year, 1)
  ON CONFLICT (document_type, year) DO UPDATE
    SET last_number = document_sequences.last_number + 1,
        updated_at  = NOW()
  RETURNING last_number INTO v_next;

  RETURN p_type || '-' || v_year::TEXT || '-' || LPAD(v_next::TEXT, 6, '0');
END;
$$;

-- ── 2. Colonnes bc_number / fa_number sur orders ─────────────────────────────

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bc_number TEXT UNIQUE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fa_number TEXT UNIQUE;

-- Mise à jour du trigger de validation : génère bc_number au format BC-YYYY-XXXXXX.
-- invoice_number reste comme alias bc_number pour rétrocompat (pages print existantes).
CREATE OR REPLACE FUNCTION public.handle_order_validated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'validated' AND OLD.status != 'validated' THEN
    IF NEW.bc_number IS NULL THEN
      NEW.bc_number := public.next_document_number('BC');
    END IF;
    -- Rétrocompat : invoice_number pointe sur le bc_number pour les anciennes pages
    IF NEW.invoice_number IS NULL THEN
      NEW.invoice_number := NEW.bc_number;
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

-- ── 3. Stock réservé sur products et product_variants ────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reserved_quantity INT NOT NULL DEFAULT 0
  CHECK (reserved_quantity >= 0);

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS reserved_quantity INT NOT NULL DEFAULT 0
  CHECK (reserved_quantity >= 0);

-- ── 4. Statuts de commande étendus ───────────────────────────────────────────

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending', 'validated', 'to_deliver',
    'partially_delivered', 'delivered', 'cancelled'
  ));

-- ── 5. Quantité livrée sur order_items ───────────────────────────────────────

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS delivered_quantity INT NOT NULL DEFAULT 0
  CHECK (delivered_quantity >= 0);

-- ── 6. Table des livraisons (livraisons partielles) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  bl_number     TEXT UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'validated')),
  delivery_date DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deliveries_order_idx ON public.deliveries(order_id);

CREATE TABLE IF NOT EXISTS public.delivery_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id   UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id),
  product_id    UUID NOT NULL REFERENCES public.products(id),
  variant_id    UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity      INT NOT NULL CHECK (quantity > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS delivery_items_delivery_idx ON public.delivery_items(delivery_id);

-- ── 7. Variantes dans client_stocks ──────────────────────────────────────────

-- Supprimer l'ancienne contrainte unique (company_id, product_id)
ALTER TABLE public.client_stocks
  DROP CONSTRAINT IF EXISTS client_stocks_company_id_product_id_key;

-- Ajouter la colonne variant_id
ALTER TABLE public.client_stocks
  ADD COLUMN IF NOT EXISTS variant_id UUID
  REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Nouvelle contrainte unique : company + product + variant
-- NULLS NOT DISTINCT : (company, product, NULL) est unique, pas dupliqué
-- (requiert PostgreSQL 15+, disponible sur Supabase)
DROP INDEX IF EXISTS client_stocks_company_product_variant_uq;
CREATE UNIQUE INDEX client_stocks_company_product_variant_uq
  ON public.client_stocks (company_id, product_id, variant_id)
  NULLS NOT DISTINCT;

-- ── 8. Variantes et delivery_id dans client_stock_movements ──────────────────

ALTER TABLE public.client_stock_movements
  ADD COLUMN IF NOT EXISTS variant_id   UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

ALTER TABLE public.client_stock_movements
  ADD COLUMN IF NOT EXISTS delivery_id  UUID REFERENCES public.deliveries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS client_stock_movements_delivery_idx
  ON public.client_stock_movements(delivery_id)
  WHERE delivery_id IS NOT NULL;

-- ── 9. RLS pour les nouvelles tables ─────────────────────────────────────────

ALTER TABLE public.deliveries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

-- Admins : accès total
DROP POLICY IF EXISTS "deliveries_admin_all"      ON public.deliveries;
DROP POLICY IF EXISTS "delivery_items_admin_all"  ON public.delivery_items;
DROP POLICY IF EXISTS "doc_seq_admin_all"         ON public.document_sequences;

CREATE POLICY "deliveries_admin_all" ON public.deliveries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "delivery_items_admin_all" ON public.delivery_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "doc_seq_admin_all" ON public.document_sequences
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Clients : lecture de leurs propres livraisons
DROP POLICY IF EXISTS "deliveries_client_select"      ON public.deliveries;
DROP POLICY IF EXISTS "delivery_items_client_select"  ON public.delivery_items;

CREATE POLICY "deliveries_client_select" ON public.deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = deliveries.order_id AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "delivery_items_client_select" ON public.delivery_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.orders o ON o.id = d.order_id
      WHERE d.id = delivery_items.delivery_id AND o.user_id = auth.uid()
    )
  );

-- ── 10. Exposer next_document_number comme RPC accessible aux admins ──────────
-- La fonction est déjà SECURITY DEFINER, elle peut être appelée via supabase.rpc().
-- Pas de politique RLS nécessaire sur la fonction elle-même.
