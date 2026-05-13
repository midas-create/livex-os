-- =============================================================================
-- Uniquement 4 modes de paiement (plus de legacy `bank`)
-- =============================================================================

UPDATE public.payments
SET payment_method = 'transfer'
WHERE payment_method = 'bank';

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('cash', 'transfer', 'cheque', 'mobile_money'));
