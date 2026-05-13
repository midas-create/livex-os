-- Départements société (profil client) + traçage sur sorties stock manuelles
-- À exécuter dans le SQL Editor Supabase après schema-v11.

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS departments TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.client_stock_movements
  ADD COLUMN IF NOT EXISTS department TEXT;

COMMENT ON COLUMN public.client_profiles.departments IS 'Liste des départements (paramétrage client) pour les sorties stock.';
COMMENT ON COLUMN public.client_stock_movements.department IS 'Département concerné pour une sortie MANUAL.';
