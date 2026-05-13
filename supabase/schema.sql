-- =============================================================================
-- LiveX Supply — Supabase Schema + Seed Data
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLES
-- =============================================================================

-- Users (mirrors auth.users with extra fields)
CREATE TABLE public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories
CREATE TABLE public.categories (
  id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name  TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subcategories
CREATE TABLE public.subcategories (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id  UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE public.products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  category_id     UUID NOT NULL REFERENCES public.categories(id),
  subcategory_id  UUID REFERENCES public.subcategories(id),
  price           NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock_quantity  INT NOT NULL DEFAULT 0,
  image_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders
CREATE TABLE public.orders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'delivered')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order Items
CREATE TABLE public.order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id),
  quantity    INT NOT NULL DEFAULT 1,
  price       NUMERIC(10, 2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Users: can read own row, admin can read all
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Categories: all authenticated users can read; only admin can write
CREATE POLICY "categories_select_all" ON public.categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "categories_write_admin" ON public.categories
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Subcategories: same as categories
CREATE POLICY "subcategories_select_all" ON public.subcategories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "subcategories_write_admin" ON public.subcategories
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Products: all authenticated users can read; only admin can write
CREATE POLICY "products_select_all" ON public.products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "products_write_admin" ON public.products
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Public catalog: anyone may read products and taxonomy (storefront without login)
CREATE POLICY "categories_public_read" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "subcategories_public_read" ON public.subcategories
  FOR SELECT USING (true);

CREATE POLICY "products_public_read" ON public.products
  FOR SELECT USING (true);

-- Orders: clients see own orders; admin sees all
CREATE POLICY "orders_select" ON public.orders
  FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "orders_insert_client" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "orders_update_admin" ON public.orders
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Order items: same logic via order ownership
CREATE POLICY "order_items_select" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_id
      AND (orders.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
      ))
    )
  );

CREATE POLICY "order_items_insert" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_id AND orders.user_id = auth.uid()
    )
  );

-- Allow product stock updates (needed when placing orders)
CREATE POLICY "products_update_stock" ON public.products
  FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================================================
-- TRIGGER: auto-create user row on signup
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, company_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    'client'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================================
-- CLIENT PROFILES (B2B — one row per client user)
-- =============================================================================

CREATE TABLE public.client_profiles (
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

CREATE INDEX client_profiles_user_id_idx ON public.client_profiles(user_id);

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

CREATE POLICY "client_profiles_update_admin" ON public.client_profiles
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (true);

-- =============================================================================
-- SEED DATA: Categories & Subcategories
-- =============================================================================

DO $$
DECLARE
  cat_paper       UUID;
  cat_writing     UUID;
  cat_adhesives   UUID;
  cat_stapling    UUID;
  cat_filing      UUID;
  cat_accessories UUID;
  cat_it          UUID;
  cat_equipment   UUID;
  cat_furniture   UUID;
  cat_shipping    UUID;
  cat_meetings    UUID;
  cat_cleaning    UUID;
  cat_breakroom   UUID;
  cat_safety      UUID;
BEGIN

-- INSERT CATEGORIES
INSERT INTO public.categories (name) VALUES ('Paper & Printing')       RETURNING id INTO cat_paper;
INSERT INTO public.categories (name) VALUES ('Writing & Correction')   RETURNING id INTO cat_writing;
INSERT INTO public.categories (name) VALUES ('Adhesives & Notes')      RETURNING id INTO cat_adhesives;
INSERT INTO public.categories (name) VALUES ('Stapling & Cutting')     RETURNING id INTO cat_stapling;
INSERT INTO public.categories (name) VALUES ('Filing & Storage')       RETURNING id INTO cat_filing;
INSERT INTO public.categories (name) VALUES ('Office Accessories')     RETURNING id INTO cat_accessories;
INSERT INTO public.categories (name) VALUES ('IT Consumables')         RETURNING id INTO cat_it;
INSERT INTO public.categories (name) VALUES ('Office Equipment')       RETURNING id INTO cat_equipment;
INSERT INTO public.categories (name) VALUES ('Furniture')              RETURNING id INTO cat_furniture;
INSERT INTO public.categories (name) VALUES ('Shipping & Mail')        RETURNING id INTO cat_shipping;
INSERT INTO public.categories (name) VALUES ('Meetings & Presentation')RETURNING id INTO cat_meetings;
INSERT INTO public.categories (name) VALUES ('Cleaning')               RETURNING id INTO cat_cleaning;
INSERT INTO public.categories (name) VALUES ('Breakroom')              RETURNING id INTO cat_breakroom;
INSERT INTO public.categories (name) VALUES ('Safety & Misc')          RETURNING id INTO cat_safety;

-- SUBCATEGORIES
INSERT INTO public.subcategories (category_id, name) VALUES
  (cat_paper, 'Copy Paper'),
  (cat_paper, 'Specialty Paper'),
  (cat_paper, 'Printer Labels'),
  (cat_paper, 'Envelopes'),

  (cat_writing, 'Ballpoint Pens'),
  (cat_writing, 'Markers & Highlighters'),
  (cat_writing, 'Pencils'),
  (cat_writing, 'Correction Fluid & Tape'),

  (cat_adhesives, 'Sticky Notes'),
  (cat_adhesives, 'Tape & Dispensers'),
  (cat_adhesives, 'Glue & Adhesives'),

  (cat_stapling, 'Staplers'),
  (cat_stapling, 'Staples'),
  (cat_stapling, 'Scissors & Cutters'),
  (cat_stapling, 'Hole Punchers'),

  (cat_filing, 'Binders & Folders'),
  (cat_filing, 'Filing Cabinets'),
  (cat_filing, 'Document Boxes'),
  (cat_filing, 'Dividers & Tabs'),

  (cat_accessories, 'Desk Organizers'),
  (cat_accessories, 'Calendars & Planners'),
  (cat_accessories, 'Calculators'),
  (cat_accessories, 'Clocks'),

  (cat_it, 'Printer Ink & Toner'),
  (cat_it, 'USB & Storage'),
  (cat_it, 'Cables & Adapters'),
  (cat_it, 'Batteries'),

  (cat_equipment, 'Printers'),
  (cat_equipment, 'Shredders'),
  (cat_equipment, 'Laminators'),
  (cat_equipment, 'Scanners'),

  (cat_furniture, 'Desks & Workstations'),
  (cat_furniture, 'Chairs'),
  (cat_furniture, 'Storage & Shelving'),
  (cat_furniture, 'Meeting Tables'),

  (cat_shipping, 'Shipping Boxes'),
  (cat_shipping, 'Bubble Wrap & Padding'),
  (cat_shipping, 'Packing Tape'),
  (cat_shipping, 'Labels & Scales'),

  (cat_meetings, 'Whiteboards'),
  (cat_meetings, 'Flipcharts'),
  (cat_meetings, 'Projector Accessories'),
  (cat_meetings, 'Presentation Folders'),

  (cat_cleaning, 'Cleaning Supplies'),
  (cat_cleaning, 'Waste Bins & Bags'),
  (cat_cleaning, 'Paper Towels & Tissues'),

  (cat_breakroom, 'Coffee & Tea'),
  (cat_breakroom, 'Cups & Utensils'),
  (cat_breakroom, 'Kitchen Appliances'),

  (cat_safety, 'First Aid'),
  (cat_safety, 'Fire Safety'),
  (cat_safety, 'PPE & Protective Gear');

-- =============================================================================
-- SEED DATA: Sample Products
-- =============================================================================

INSERT INTO public.products (name, category_id, subcategory_id, price, stock_quantity)
SELECT
  p.name,
  c.id AS category_id,
  s.id AS subcategory_id,
  p.price,
  p.stock
FROM (VALUES
  ('A4 Copy Paper 80g — 500 sheets',          'Paper & Printing',        'Copy Paper',              4.99,  250),
  ('A4 Copy Paper 90g — 500 sheets',          'Paper & Printing',        'Copy Paper',              6.49,  180),
  ('A3 Copy Paper 80g — 250 sheets',          'Paper & Printing',        'Copy Paper',              8.99,  120),
  ('Glossy Photo Paper A4 — 50 sheets',       'Paper & Printing',        'Specialty Paper',        11.99,   60),
  ('A4 Label Sheets 63.5×38.1mm',             'Paper & Printing',        'Printer Labels',          7.99,  100),
  ('C5 Envelopes self-seal — box 500',        'Paper & Printing',        'Envelopes',               14.99,  80),

  ('Ballpoint Pen Blue — box 50',             'Writing & Correction',    'Ballpoint Pens',           8.99, 200),
  ('Ballpoint Pen Black — box 50',            'Writing & Correction',    'Ballpoint Pens',           8.99, 200),
  ('Ballpoint Pen Red — box 50',              'Writing & Correction',    'Ballpoint Pens',           8.99, 150),
  ('Yellow Highlighter — pack 10',            'Writing & Correction',    'Markers & Highlighters',   5.49, 180),
  ('Assorted Highlighters — pack 5',          'Writing & Correction',    'Markers & Highlighters',   4.99, 220),
  ('HB Pencils — box 100',                    'Writing & Correction',    'Pencils',                  9.99, 150),
  ('Correction Fluid 20ml',                   'Writing & Correction',    'Correction Fluid & Tape',  1.99, 300),
  ('Correction Tape 5mm×8m',                  'Writing & Correction',    'Correction Fluid & Tape',  2.49, 280),

  ('Sticky Notes 76×76mm Yellow — 12 pads',   'Adhesives & Notes',       'Sticky Notes',            11.99, 160),
  ('Sticky Notes Assorted Colours — 8 pads',  'Adhesives & Notes',       'Sticky Notes',             9.49, 140),
  ('Clear Tape 33m×19mm — pack 6',            'Adhesives & Notes',       'Tape & Dispensers',        5.99, 250),
  ('Double-Sided Tape 33m',                   'Adhesives & Notes',       'Tape & Dispensers',        3.99, 180),
  ('Glue Stick 40g — pack 10',                'Adhesives & Notes',       'Glue & Adhesives',         7.49, 200),

  ('Heavy Duty Stapler 50 sheets',            'Stapling & Cutting',      'Staplers',                14.99,  90),
  ('Staples 26/6 — box 5000',                 'Stapling & Cutting',      'Staples',                  2.99, 350),
  ('Scissors 21cm',                           'Stapling & Cutting',      'Scissors & Cutters',       3.99, 180),
  ('Box Cutter A3',                           'Stapling & Cutting',      'Scissors & Cutters',       5.49, 120),
  ('2-Hole Punch 40 sheets',                  'Stapling & Cutting',      'Hole Punchers',            8.99,  70),

  ('A4 Ring Binder 4cm — pack 10',            'Filing & Storage',        'Binders & Folders',       19.99,  80),
  ('A4 Suspension Files — box 25',            'Filing & Storage',        'Binders & Folders',       12.99, 100),
  ('Archive Box with Lid',                    'Filing & Storage',        'Document Boxes',           4.49, 200),
  ('Manila Index Dividers A4 — pack 10',      'Filing & Storage',        'Dividers & Tabs',          3.99, 150),

  ('Mesh Desk Organiser 6-compartment',       'Office Accessories',      'Desk Organizers',         12.99,  60),
  ('Desk Calendar 2025',                      'Office Accessories',      'Calendars & Planners',    6.99,  120),
  ('Scientific Calculator',                   'Office Accessories',      'Calculators',             12.99,  40),

  ('HP 302 Black Ink Cartridge',              'IT Consumables',          'Printer Ink & Toner',     18.99,  90),
  ('HP 302 Colour Ink Cartridge',             'IT Consumables',          'Printer Ink & Toner',     22.99,  70),
  ('USB-A to USB-C Cable 1m',                 'IT Consumables',          'Cables & Adapters',        6.99, 120),
  ('USB Flash Drive 32GB',                    'IT Consumables',          'USB & Storage',           11.99,  80),
  ('AA Batteries — pack 40',                  'IT Consumables',          'Batteries',               12.49, 150),

  ('A2 Drywipe Whiteboard',                   'Meetings & Presentation', 'Whiteboards',             39.99,  25),
  ('Flipchart Easel',                         'Meetings & Presentation', 'Flipcharts',              59.99,  15),
  ('Flipchart Paper Pad A1 — pack 5',         'Meetings & Presentation', 'Flipcharts',              24.99,  40),
  ('Presentation Folders A4 — pack 10',       'Meetings & Presentation', 'Presentation Folders',    8.99,  100),

  ('Multi-Surface Cleaner 750ml',             'Cleaning',                'Cleaning Supplies',        3.49, 200),
  ('Hand Sanitiser Gel 500ml',                'Cleaning',                'Cleaning Supplies',        4.99, 250),
  ('Black Bin Bags 120L — box 25',            'Cleaning',                'Waste Bins & Bags',        9.99, 150),
  ('Kitchen Roll — pack 4',                   'Cleaning',                'Paper Towels & Tissues',   4.49, 300),

  ('Instant Coffee 500g',                     'Breakroom',               'Coffee & Tea',            12.99, 100),
  ('Tea Bags Assorted 80-pack',               'Breakroom',               'Coffee & Tea',             5.99, 120),
  ('Plastic Cups 200ml — pack 100',           'Breakroom',               'Cups & Utensils',          4.49, 200),

  ('First Aid Kit 50-piece',                  'Safety & Misc',           'First Aid',               24.99,  30),
  ('Fire Extinguisher 2kg CO2',               'Safety & Misc',           'Fire Safety',             49.99,  20),
  ('Safety Glasses — pack 5',                 'Safety & Misc',           'PPE & Protective Gear',   14.99,  50)
) AS p(name, cat_name, sub_name, price, stock)
JOIN public.categories c ON c.name = p.cat_name
LEFT JOIN public.subcategories s ON s.name = p.sub_name AND s.category_id = c.id;

END $$;
