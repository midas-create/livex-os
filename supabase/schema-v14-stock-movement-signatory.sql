-- Signataire de la sortie stock manuelle
-- A executer dans le SQL Editor Supabase apres schema-v13.

ALTER TABLE public.client_stock_movements
  ADD COLUMN IF NOT EXISTS signed_by TEXT;

COMMENT ON COLUMN public.client_stock_movements.signed_by IS 'Nom du signataire (agent / employe) pour une sortie MANUAL.';
