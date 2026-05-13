-- =============================================================================
-- SEED: Catégories et sous-catégories en français
-- Exécuter dans Supabase → SQL Editor
-- IMPORTANT: Ne crée aucun produit — les produits sont ajoutés manuellement
-- =============================================================================

-- Vider les données existantes (respecter les clés étrangères)
TRUNCATE TABLE public.order_items CASCADE;
TRUNCATE TABLE public.orders CASCADE;
TRUNCATE TABLE public.stock_movements CASCADE;
TRUNCATE TABLE public.products CASCADE;
TRUNCATE TABLE public.subcategories CASCADE;
TRUNCATE TABLE public.categories CASCADE;

-- =============================================================================
-- CATÉGORIES
-- =============================================================================
INSERT INTO public.categories (id, name) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Papier et Impression'),
  ('c1000000-0000-0000-0000-000000000002', 'Écriture et Correction'),
  ('c1000000-0000-0000-0000-000000000003', 'Adhésifs et Colles'),
  ('c1000000-0000-0000-0000-000000000004', 'Agrafage et Découpe'),
  ('c1000000-0000-0000-0000-000000000005', 'Classement et Rangement'),
  ('c1000000-0000-0000-0000-000000000006', 'Accessoires de Bureau'),
  ('c1000000-0000-0000-0000-000000000007', 'Informatique et Consommables'),
  ('c1000000-0000-0000-0000-000000000008', 'Matériel Bureautique'),
  ('c1000000-0000-0000-0000-000000000009', 'Mobilier'),
  ('c1000000-0000-0000-0000-000000000010', 'Expédition et Courrier'),
  ('c1000000-0000-0000-0000-000000000011', 'Réunions et Présentation'),
  ('c1000000-0000-0000-0000-000000000012', 'Nettoyage'),
  ('c1000000-0000-0000-0000-000000000013', 'Pause et Restauration'),
  ('c1000000-0000-0000-0000-000000000014', 'Sécurité et Divers');

-- =============================================================================
-- SOUS-CATÉGORIES
-- =============================================================================

-- Papier et Impression
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Ramettes de papier'),
  ('c1000000-0000-0000-0000-000000000001', 'Papier spécial'),
  ('c1000000-0000-0000-0000-000000000001', 'Enveloppes'),
  ('c1000000-0000-0000-0000-000000000001', 'Cartouches d''encre'),
  ('c1000000-0000-0000-0000-000000000001', 'Toners laser'),
  ('c1000000-0000-0000-0000-000000000001', 'Papier photo');

-- Écriture et Correction
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000002', 'Stylos bille'),
  ('c1000000-0000-0000-0000-000000000002', 'Stylos roller et plume'),
  ('c1000000-0000-0000-0000-000000000002', 'Crayons et porte-mines'),
  ('c1000000-0000-0000-0000-000000000002', 'Marqueurs et surligneurs'),
  ('c1000000-0000-0000-0000-000000000002', 'Correcteurs et effaceurs'),
  ('c1000000-0000-0000-0000-000000000002', 'Recharges et mines');

-- Adhésifs et Colles
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'Rubans adhésifs'),
  ('c1000000-0000-0000-0000-000000000003', 'Post-it et notes adhésives'),
  ('c1000000-0000-0000-0000-000000000003', 'Colles et adhésifs'),
  ('c1000000-0000-0000-0000-000000000003', 'Dévidoirs de scotch'),
  ('c1000000-0000-0000-0000-000000000003', 'Étiquettes autocollantes');

-- Agrafage et Découpe
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000004', 'Agrafeuses'),
  ('c1000000-0000-0000-0000-000000000004', 'Agrafes'),
  ('c1000000-0000-0000-0000-000000000004', 'Perforateurs'),
  ('c1000000-0000-0000-0000-000000000004', 'Ciseaux et coupe-papier'),
  ('c1000000-0000-0000-0000-000000000004', 'Massicots'),
  ('c1000000-0000-0000-0000-000000000004', 'Trombones et attaches');

-- Classement et Rangement
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000005', 'Classeurs et reliures'),
  ('c1000000-0000-0000-0000-000000000005', 'Chemises et pochettes'),
  ('c1000000-0000-0000-0000-000000000005', 'Intercalaires et onglets'),
  ('c1000000-0000-0000-0000-000000000005', 'Boîtes de rangement'),
  ('c1000000-0000-0000-0000-000000000005', 'Porte-documents'),
  ('c1000000-0000-0000-0000-000000000005', 'Archivage');

-- Accessoires de Bureau
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000006', 'Calculatrices'),
  ('c1000000-0000-0000-0000-000000000006', 'Agenda et planners'),
  ('c1000000-0000-0000-0000-000000000006', 'Blocs-notes et cahiers'),
  ('c1000000-0000-0000-0000-000000000006', 'Porte-stylos et organisateurs'),
  ('c1000000-0000-0000-0000-000000000006', 'Sous-mains et protège-bureaux'),
  ('c1000000-0000-0000-0000-000000000006', 'Presse-papiers et pinces');

-- Informatique et Consommables
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000007', 'Souris et claviers'),
  ('c1000000-0000-0000-0000-000000000007', 'Câbles et adaptateurs'),
  ('c1000000-0000-0000-0000-000000000007', 'Clés USB et stockage'),
  ('c1000000-0000-0000-0000-000000000007', 'Protège-écrans'),
  ('c1000000-0000-0000-0000-000000000007', 'Nettoyage écrans et PC'),
  ('c1000000-0000-0000-0000-000000000007', 'Piles et batteries');

-- Matériel Bureautique
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000008', 'Imprimantes'),
  ('c1000000-0000-0000-0000-000000000008', 'Scanners'),
  ('c1000000-0000-0000-0000-000000000008', 'Téléphones de bureau'),
  ('c1000000-0000-0000-0000-000000000008', 'Destructeurs de documents'),
  ('c1000000-0000-0000-0000-000000000008', 'Plastifieuses'),
  ('c1000000-0000-0000-0000-000000000008', 'Machines à affranchir');

-- Mobilier
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000009', 'Chaises de bureau'),
  ('c1000000-0000-0000-0000-000000000009', 'Bureaux et tables'),
  ('c1000000-0000-0000-0000-000000000009', 'Armoires et caissons'),
  ('c1000000-0000-0000-0000-000000000009', 'Étagères'),
  ('c1000000-0000-0000-0000-000000000009', 'Accessoires de mobilier');

-- Expédition et Courrier
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000010', 'Cartons d''emballage'),
  ('c1000000-0000-0000-0000-000000000010', 'Bulles et mousses'),
  ('c1000000-0000-0000-0000-000000000010', 'Rubans d''emballage'),
  ('c1000000-0000-0000-0000-000000000010', 'Enveloppes matelassées'),
  ('c1000000-0000-0000-0000-000000000010', 'Balance postale');

-- Réunions et Présentation
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000011', 'Tableaux blancs'),
  ('c1000000-0000-0000-0000-000000000011', 'Marqueurs pour tableau'),
  ('c1000000-0000-0000-0000-000000000011', 'Paperboards'),
  ('c1000000-0000-0000-0000-000000000011', 'Présentoirs et lutrins'),
  ('c1000000-0000-0000-0000-000000000011', 'Pointeurs laser');

-- Nettoyage
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000012', 'Produits ménagers'),
  ('c1000000-0000-0000-0000-000000000012', 'Sacs poubelle'),
  ('c1000000-0000-0000-0000-000000000012', 'Essuie-tout et papier toilette'),
  ('c1000000-0000-0000-0000-000000000012', 'Désinfectants'),
  ('c1000000-0000-0000-0000-000000000012', 'Gants et équipements');

-- Pause et Restauration
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000013', 'Café et thé'),
  ('c1000000-0000-0000-0000-000000000013', 'Capsules et dosettes'),
  ('c1000000-0000-0000-0000-000000000013', 'Sucre et condiments'),
  ('c1000000-0000-0000-0000-000000000013', 'Gobelets et vaisselle jetable'),
  ('c1000000-0000-0000-0000-000000000013', 'Machine à café');

-- Sécurité et Divers
INSERT INTO public.subcategories (category_id, name) VALUES
  ('c1000000-0000-0000-0000-000000000014', 'Badges et porte-noms'),
  ('c1000000-0000-0000-0000-000000000014', 'Coffres-forts'),
  ('c1000000-0000-0000-0000-000000000014', 'Extincteurs'),
  ('c1000000-0000-0000-0000-000000000014', 'Trousses de premiers secours'),
  ('c1000000-0000-0000-0000-000000000014', 'Divers');
