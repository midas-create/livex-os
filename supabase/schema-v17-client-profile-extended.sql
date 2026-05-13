-- ============================================================
-- schema-v17-client-profile-extended.sql
-- Extend client_profiles for full B2B profile:
--   • WhatsApp (company-level)
--   • Contact person details (position, direct phone/whatsapp/email)
--   • Delivery address + notes (separate from company address)
--   • profile_completed flag (gates dashboard access)
--
-- Also fixes: admins were blocked by RLS from updating
-- client profiles (payment_terms_days edit was silently failing).
--
-- Run in Supabase SQL Editor after all prior migrations.
-- ============================================================

-- 1. Add new columns
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS whatsapp          TEXT,
  ADD COLUMN IF NOT EXISTS contact_position  TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone     TEXT,
  ADD COLUMN IF NOT EXISTS contact_whatsapp  TEXT,
  ADD COLUMN IF NOT EXISTS contact_email     TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address  TEXT,
  ADD COLUMN IF NOT EXISTS delivery_notes    TEXT,
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. All existing rows were completed through the previous form
UPDATE public.client_profiles
SET profile_completed = TRUE
WHERE profile_completed = FALSE;

-- 3. Fix UPDATE policy so admins can edit client profiles
--    (payment_terms, fiscal info, contact details, etc.)
DROP POLICY IF EXISTS "client_profiles_update" ON public.client_profiles;

CREATE POLICY "client_profiles_update" ON public.client_profiles
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ============================================================
-- Verification
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'client_profiles'
-- ORDER BY ordinal_position;
-- ============================================================
