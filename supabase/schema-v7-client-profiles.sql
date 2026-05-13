-- =============================================================================
-- B2B client_profiles (1:1 with public.users for clients)
-- Run in Supabase SQL Editor after prior migrations
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  nif TEXT NOT NULL DEFAULT '',
  stat TEXT NOT NULL DEFAULT '',
  rcs TEXT NOT NULL DEFAULT '',
  manager_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  region TEXT NOT NULL,
  gps_lat NUMERIC(10, 7),
  gps_lng NUMERIC(10, 7),
  payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0 AND payment_terms_days <= 365),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_profiles_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS client_profiles_user_id_idx ON public.client_profiles(user_id);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_profiles_select" ON public.client_profiles
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "client_profiles_insert" ON public.client_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "client_profiles_update" ON public.client_profiles
  FOR UPDATE USING (auth.uid() = user_id);
