-- =============================================================================
-- B2B paiements, échéances, trésorerie — exécuter dans Supabase SQL Editor
-- =============================================================================

-- Délais de paiement client (jours après commande)
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 30
  CHECK (payment_terms_days >= 0 AND payment_terms_days <= 365);

-- Commandes : échéance et montant payé (contrôle de trésorerie, pas compta)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0);

-- Référence de paiement + modes élargis
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS reference TEXT;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('cash', 'cheque', 'transfer', 'mobile_money', 'bank'));

-- Sorties fournisseurs / charges (saisie manuelle pour prévision de trésorerie)
CREATE TABLE IF NOT EXISTS public.cashflow_outflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cashflow_outflows_due_date_idx ON public.cashflow_outflows(due_date);

ALTER TABLE public.cashflow_outflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cashflow_outflows_admin_all" ON public.cashflow_outflows;
CREATE POLICY "cashflow_outflows_admin_all" ON public.cashflow_outflows
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin peut ajuster les délais de paiement sur le profil client
DROP POLICY IF EXISTS "client_profiles_update_admin" ON public.client_profiles;
CREATE POLICY "client_profiles_update_admin" ON public.client_profiles
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (true);

-- Rattrapage : paid_amount depuis les paiements existants
UPDATE public.orders o
SET paid_amount = COALESCE((
  SELECT SUM(p.amount) FROM public.payments p WHERE p.order_id = o.id
), 0);

-- Rattrapage : due_date si manquant
UPDATE public.orders o
SET due_date = ((o.created_at AT TIME ZONE 'UTC')::date + COALESCE(
  (SELECT cp.payment_terms_days FROM public.client_profiles cp WHERE cp.user_id = o.user_id),
  30
))
WHERE o.due_date IS NULL;
