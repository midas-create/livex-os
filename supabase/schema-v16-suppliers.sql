-- ============================================================
-- schema-v16-suppliers.sql
-- Structured supplier entities for Livex OS
-- Run this in Supabase SQL Editor before using the
-- Fournisseurs page or the supplier selector in Achats.
-- ============================================================

-- 1. Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text NOT NULL,
  phone            text,
  email            text,
  address          text,
  nif              text,
  contact          text,
  payment_terms_days integer DEFAULT 0 NOT NULL,
  notes            text,
  created_at       timestamptz DEFAULT now() NOT NULL
);

-- 2. Add supplier_id FK to purchases (nullable for backward compatibility)
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

-- 3. Enable RLS on suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- 4. Admin full access policy
DROP POLICY IF EXISTS "admin_all_suppliers" ON suppliers;
CREATE POLICY "admin_all_suppliers" ON suppliers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- 5. (Optional) Migrate existing free-text supplier names to supplier rows
-- Uncomment if you want to auto-create suppliers from existing purchase data.
-- Note: this creates one supplier per unique name — review before running.
--
-- INSERT INTO suppliers (name)
-- SELECT DISTINCT supplier_name
-- FROM purchases
-- WHERE supplier_name IS NOT NULL
--   AND supplier_name <> ''
-- ON CONFLICT DO NOTHING;
--
-- UPDATE purchases p
-- SET supplier_id = s.id
-- FROM suppliers s
-- WHERE s.name = p.supplier_name
--   AND p.supplier_id IS NULL;

-- ============================================================
-- Verification query (run separately to confirm success)
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name = 'suppliers';
-- ============================================================
