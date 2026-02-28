-- ============================================================================
-- Migration: Fresh Seed Data — complete and correct structure
-- Date: 2026-02-24
--
-- DATA MODEL (how products + visual catalog works):
--   • One product row = one VARIANT (size + color combination)
--   • base_code groups all variants of the same model  (e.g. "CHA-001")
--   • base_name is the clean model name                (e.g. "Chaleco Army")
--   • barcode = {base_code}-{SIZE_CODE}{COLOR_CODE}    (e.g. "CHA-001-SN")
--   • product_images stores one image per base_code (model-level, color=NULL)
--     or per base_code+color (color-specific)
--   • images point to public picsum.photos for demo purposes
--
-- Run BEFORE the migrations:
--   20260224000001_product_images.sql
--   20260224000002_add_base_code_to_products.sql
-- ============================================================================

-- ── 0. Wipe existing catalog/inventory data ──────────────────────────────────
-- Keep: users, auth, clients, sales, credit_plans, installments, payments, cash, audit
-- We delete sale_items (frees product FK) but NOT sales/credits (credit_plans.sale_id → sales).
DELETE FROM public.product_images;
DELETE FROM public.stock;
DELETE FROM public.movements;
DELETE FROM public.sale_items;   -- child of sales → safe to delete
-- NOTE: Do NOT delete sales — credit_plans.sale_id references them
DELETE FROM public.products;
DELETE FROM public.sizes;
DELETE FROM public.categories;
DELETE FROM public.brands;
DELETE FROM public.suppliers;
DELETE FROM public.lines;

-- ── 1. Lines ─────────────────────────────────────────────────────────────────

INSERT INTO public.lines (id, name, description, active) VALUES
  ('11111111-0001-0000-0000-000000000000', 'Mujeres',     'Ropa femenina',             true),
  ('11111111-0002-0000-0000-000000000000', 'Hombres',     'Ropa masculina',            true),
  ('11111111-0003-0000-0000-000000000000', 'Niños',       'Ropa infantil',             true),
  ('11111111-0004-0000-0000-000000000000', 'Accesorios',  'Bolsos, cinturones, etc.',  true);

-- ── 2. Categories ─────────────────────────────────────────────────────────────

INSERT INTO public.categories (id, name, line_id, description, active) VALUES
  -- Mujeres
  ('22222222-0001-0000-0000-000000000000', 'Blusas',     '11111111-0001-0000-0000-000000000000', null, true),
  ('22222222-0002-0000-0000-000000000000', 'Jeans',      '11111111-0001-0000-0000-000000000000', null, true),
  ('22222222-0003-0000-0000-000000000000', 'Vestidos',   '11111111-0001-0000-0000-000000000000', null, true),
  ('22222222-0004-0000-0000-000000000000', 'Casacas',    '11111111-0001-0000-0000-000000000000', null, true),
  ('22222222-0005-0000-0000-000000000000', 'Pantalones', '11111111-0001-0000-0000-000000000000', null, true),
  -- Hombres
  ('22222222-0006-0000-0000-000000000000', 'Polos',      '11111111-0002-0000-0000-000000000000', null, true),
  ('22222222-0007-0000-0000-000000000000', 'Jeans',      '11111111-0002-0000-0000-000000000000', null, true),
  ('22222222-0008-0000-0000-000000000000', 'Camisas',    '11111111-0002-0000-0000-000000000000', null, true),
  ('22222222-0009-0000-0000-000000000000', 'Casacas',    '11111111-0002-0000-0000-000000000000', null, true),
  -- Niños
  ('22222222-0010-0000-0000-000000000000', 'Conjuntos',  '11111111-0003-0000-0000-000000000000', null, true);

-- ── 3. Brands ─────────────────────────────────────────────────────────────────

INSERT INTO public.brands (id, name, active) VALUES
  ('33333333-0001-0000-0000-000000000000', 'Adiction',   true),
  ('33333333-0002-0000-0000-000000000000', 'Zara',       true),
  ('33333333-0003-0000-0000-000000000000', 'H&M',        true),
  ('33333333-0004-0000-0000-000000000000', 'Forever 21', true),
  ('33333333-0005-0000-0000-000000000000', 'Mango',      true);

-- ── 4. Supplier ───────────────────────────────────────────────────────────────

INSERT INTO public.suppliers (id, name, contact_name, phone, active) VALUES
  ('44444444-0001-0000-0000-000000000000', 'Gamarra Trading S.A.C.', 'Carlos Quispe', '999000001', true),
  ('44444444-0002-0000-0000-000000000000', 'Importaciones Lima', 'Rosa Flores', '999000002', true);

-- ── 5. Products ───────────────────────────────────────────────────────────────
-- Barcode format: {base_code}-{SIZE}{COLOR_INITIAL}
-- COLOR initials: N=Negro, B=Blanco, R=Rosado, A=Azul, V=Verde, G=Gris, Be=Beige, Ce=Celeste, Ro=Rojo

-- ──────────────────────────────────────────────────────────────────────────────
-- MODEL 1: Blusa Floral (BLS-001) — Mujeres / Blusas — Adiction
--   Colors: Rosado, Blanco, Azul | Sizes: S, M, L, XL
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO public.products (barcode, name, base_code, base_name, category_id, brand_id, line_id, size, color, price, purchase_price, active) VALUES
  ('BLS-001-SR','Blusa Floral - S - Rosado', 'BLS-001','Blusa Floral','22222222-0001-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','S','Rosado',55,30,true),
  ('BLS-001-MR','Blusa Floral - M - Rosado', 'BLS-001','Blusa Floral','22222222-0001-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','M','Rosado',55,30,true),
  ('BLS-001-LR','Blusa Floral - L - Rosado', 'BLS-001','Blusa Floral','22222222-0001-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','L','Rosado',55,30,true),
  ('BLS-001-XR','Blusa Floral - XL - Rosado','BLS-001','Blusa Floral','22222222-0001-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','XL','Rosado',55,30,true),
  ('BLS-001-SB','Blusa Floral - S - Blanco', 'BLS-001','Blusa Floral','22222222-0001-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','S','Blanco',55,30,true),
  ('BLS-001-MB','Blusa Floral - M - Blanco', 'BLS-001','Blusa Floral','22222222-0001-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','M','Blanco',55,30,true),
  ('BLS-001-LB','Blusa Floral - L - Blanco', 'BLS-001','Blusa Floral','22222222-0001-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','L','Blanco',55,30,true),
  ('BLS-001-SA','Blusa Floral - S - Azul',   'BLS-001','Blusa Floral','22222222-0001-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','S','Azul',55,30,true),
  ('BLS-001-MA','Blusa Floral - M - Azul',   'BLS-001','Blusa Floral','22222222-0001-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','M','Azul',55,30,true),
  ('BLS-001-LA','Blusa Floral - L - Azul',   'BLS-001','Blusa Floral','22222222-0001-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','L','Azul',55,30,true);

-- MODEL 2: Jean Skinny (JEA-001) — Mujeres / Jeans — Zara
--   Colors: Azul, Negro | Sizes: 28, 30, 32, 34
INSERT INTO public.products (barcode, name, base_code, base_name, category_id, brand_id, line_id, size, color, price, purchase_price, active) VALUES
  ('JEA-001-28A','Jean Skinny - 28 - Azul',  'JEA-001','Jean Skinny','22222222-0002-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','28','Azul',120,70,true),
  ('JEA-001-30A','Jean Skinny - 30 - Azul',  'JEA-001','Jean Skinny','22222222-0002-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','30','Azul',120,70,true),
  ('JEA-001-32A','Jean Skinny - 32 - Azul',  'JEA-001','Jean Skinny','22222222-0002-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','32','Azul',120,70,true),
  ('JEA-001-34A','Jean Skinny - 34 - Azul',  'JEA-001','Jean Skinny','22222222-0002-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','34','Azul',120,70,true),
  ('JEA-001-28N','Jean Skinny - 28 - Negro',  'JEA-001','Jean Skinny','22222222-0002-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','28','Negro',120,70,true),
  ('JEA-001-30N','Jean Skinny - 30 - Negro',  'JEA-001','Jean Skinny','22222222-0002-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','30','Negro',120,70,true),
  ('JEA-001-32N','Jean Skinny - 32 - Negro',  'JEA-001','Jean Skinny','22222222-0002-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','32','Negro',120,70,true),
  ('JEA-001-34N','Jean Skinny - 34 - Negro',  'JEA-001','Jean Skinny','22222222-0002-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','34','Negro',120,70,true);

-- MODEL 3: Vestido Casual (VES-001) — Mujeres / Vestidos — H&M
--   Colors: Negro, Rojo, Celeste | Sizes: XS, S, M, L
INSERT INTO public.products (barcode, name, base_code, base_name, category_id, brand_id, line_id, size, color, price, purchase_price, active) VALUES
  ('VES-001-XN','Vestido Casual - XS - Negro',  'VES-001','Vestido Casual','22222222-0003-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','XS','Negro',150,85,true),
  ('VES-001-SN','Vestido Casual - S - Negro',   'VES-001','Vestido Casual','22222222-0003-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','S','Negro',150,85,true),
  ('VES-001-MN','Vestido Casual - M - Negro',   'VES-001','Vestido Casual','22222222-0003-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','M','Negro',150,85,true),
  ('VES-001-LN','Vestido Casual - L - Negro',   'VES-001','Vestido Casual','22222222-0003-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','L','Negro',150,85,true),
  ('VES-001-SR','Vestido Casual - S - Rojo',    'VES-001','Vestido Casual','22222222-0003-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','S','Rojo',150,85,true),
  ('VES-001-MR','Vestido Casual - M - Rojo',    'VES-001','Vestido Casual','22222222-0003-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','M','Rojo',150,85,true),
  ('VES-001-LR','Vestido Casual - L - Rojo',    'VES-001','Vestido Casual','22222222-0003-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','L','Rojo',150,85,true),
  ('VES-001-SC','Vestido Casual - S - Celeste', 'VES-001','Vestido Casual','22222222-0003-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','S','Celeste',150,85,true),
  ('VES-001-MC','Vestido Casual - M - Celeste', 'VES-001','Vestido Casual','22222222-0003-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','M','Celeste',150,85,true);

-- MODEL 4: Casaca Denim (CAS-001) — Mujeres / Casacas — Forever 21
--   Colors: Azul, Negro | Sizes: S, M, L, XL
INSERT INTO public.products (barcode, name, base_code, base_name, category_id, brand_id, line_id, size, color, price, purchase_price, active) VALUES
  ('CAS-001-SA','Casaca Denim - S - Azul',  'CAS-001','Casaca Denim','22222222-0004-0000-0000-000000000000','33333333-0004-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','S','Azul',180,110,true),
  ('CAS-001-MA','Casaca Denim - M - Azul',  'CAS-001','Casaca Denim','22222222-0004-0000-0000-000000000000','33333333-0004-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','M','Azul',180,110,true),
  ('CAS-001-LA','Casaca Denim - L - Azul',  'CAS-001','Casaca Denim','22222222-0004-0000-0000-000000000000','33333333-0004-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','L','Azul',180,110,true),
  ('CAS-001-SN','Casaca Denim - S - Negro', 'CAS-001','Casaca Denim','22222222-0004-0000-0000-000000000000','33333333-0004-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','S','Negro',180,110,true),
  ('CAS-001-MN','Casaca Denim - M - Negro', 'CAS-001','Casaca Denim','22222222-0004-0000-0000-000000000000','33333333-0004-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','M','Negro',180,110,true),
  ('CAS-001-LN','Casaca Denim - L - Negro', 'CAS-001','Casaca Denim','22222222-0004-0000-0000-000000000000','33333333-0004-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','L','Negro',180,110,true);

-- MODEL 5: Chaleco Army (CHA-001) — Mujeres / Casacas — Adiction
--   Colors: Verde, Negro, Beige | Sizes: S, M, L, XL, XXL
INSERT INTO public.products (barcode, name, base_code, base_name, category_id, brand_id, line_id, size, color, price, purchase_price, active) VALUES
  ('CHA-001-SV','Chaleco Army - S - Verde',  'CHA-001','Chaleco Army','22222222-0004-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','S','Verde',350,200,true),
  ('CHA-001-MV','Chaleco Army - M - Verde',  'CHA-001','Chaleco Army','22222222-0004-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','M','Verde',350,200,true),
  ('CHA-001-LV','Chaleco Army - L - Verde',  'CHA-001','Chaleco Army','22222222-0004-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','L','Verde',350,200,true),
  ('CHA-001-XV','Chaleco Army - XL - Verde', 'CHA-001','Chaleco Army','22222222-0004-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','XL','Verde',350,200,true),
  ('CHA-001-SN','Chaleco Army - S - Negro',  'CHA-001','Chaleco Army','22222222-0004-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','S','Negro',350,200,true),
  ('CHA-001-MN','Chaleco Army - M - Negro',  'CHA-001','Chaleco Army','22222222-0004-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','M','Negro',350,200,true),
  ('CHA-001-LN','Chaleco Army - L - Negro',  'CHA-001','Chaleco Army','22222222-0004-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','L','Negro',350,200,true),
  ('CHA-001-SBe','Chaleco Army - S - Beige', 'CHA-001','Chaleco Army','22222222-0004-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','S','Beige',350,200,true),
  ('CHA-001-MBe','Chaleco Army - M - Beige', 'CHA-001','Chaleco Army','22222222-0004-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','M','Beige',350,200,true),
  ('CHA-001-LBe','Chaleco Army - L - Beige', 'CHA-001','Chaleco Army','22222222-0004-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0001-0000-0000-000000000000','L','Beige',350,200,true);

-- MODEL 6: Polo Básico (POL-001) — Hombres / Polos — H&M
--   Colors: Negro, Blanco, Gris, Azul | Sizes: S, M, L, XL, XXL
INSERT INTO public.products (barcode, name, base_code, base_name, category_id, brand_id, line_id, size, color, price, purchase_price, active) VALUES
  ('POL-001-SN','Polo Básico - S - Negro',  'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Negro',45,22,true),
  ('POL-001-MN','Polo Básico - M - Negro',  'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Negro',45,22,true),
  ('POL-001-LN','Polo Básico - L - Negro',  'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','L','Negro',45,22,true),
  ('POL-001-XN','Polo Básico - XL - Negro', 'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','XL','Negro',45,22,true),
  ('POL-001-SB','Polo Básico - S - Blanco', 'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Blanco',45,22,true),
  ('POL-001-MB','Polo Básico - M - Blanco', 'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Blanco',45,22,true),
  ('POL-001-LB','Polo Básico - L - Blanco', 'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','L','Blanco',45,22,true),
  ('POL-001-SG','Polo Básico - S - Gris',   'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Gris',45,22,true),
  ('POL-001-MG','Polo Básico - M - Gris',   'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Gris',45,22,true),
  ('POL-001-LG','Polo Básico - L - Gris',   'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','L','Gris',45,22,true),
  ('POL-001-SA','Polo Básico - S - Azul',   'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Azul',45,22,true),
  ('POL-001-MA','Polo Básico - M - Azul',   'POL-001','Polo Básico','22222222-0006-0000-0000-000000000000','33333333-0003-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Azul',45,22,true);

-- MODEL 7: Camisa Formal (CAM-001) — Hombres / Camisas — Mango
--   Colors: Blanco, Celeste, Gris | Sizes: S, M, L, XL
INSERT INTO public.products (barcode, name, base_code, base_name, category_id, brand_id, line_id, size, color, price, purchase_price, active) VALUES
  ('CAM-001-SB','Camisa Formal - S - Blanco',  'CAM-001','Camisa Formal','22222222-0008-0000-0000-000000000000','33333333-0005-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Blanco',95,55,true),
  ('CAM-001-MB','Camisa Formal - M - Blanco',  'CAM-001','Camisa Formal','22222222-0008-0000-0000-000000000000','33333333-0005-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Blanco',95,55,true),
  ('CAM-001-LB','Camisa Formal - L - Blanco',  'CAM-001','Camisa Formal','22222222-0008-0000-0000-000000000000','33333333-0005-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','L','Blanco',95,55,true),
  ('CAM-001-XB','Camisa Formal - XL - Blanco', 'CAM-001','Camisa Formal','22222222-0008-0000-0000-000000000000','33333333-0005-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','XL','Blanco',95,55,true),
  ('CAM-001-SC','Camisa Formal - S - Celeste',  'CAM-001','Camisa Formal','22222222-0008-0000-0000-000000000000','33333333-0005-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Celeste',95,55,true),
  ('CAM-001-MC','Camisa Formal - M - Celeste',  'CAM-001','Camisa Formal','22222222-0008-0000-0000-000000000000','33333333-0005-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Celeste',95,55,true),
  ('CAM-001-LC','Camisa Formal - L - Celeste',  'CAM-001','Camisa Formal','22222222-0008-0000-0000-000000000000','33333333-0005-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','L','Celeste',95,55,true),
  ('CAM-001-SG','Camisa Formal - S - Gris',    'CAM-001','Camisa Formal','22222222-0008-0000-0000-000000000000','33333333-0005-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Gris',95,55,true),
  ('CAM-001-MG','Camisa Formal - M - Gris',    'CAM-001','Camisa Formal','22222222-0008-0000-0000-000000000000','33333333-0005-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Gris',95,55,true);

-- MODEL 8: Jean Recto (JEA-002) — Hombres / Jeans — Zara
--   Colors: Azul, Negro, Gris | Sizes: 28, 30, 32, 34, 36
INSERT INTO public.products (barcode, name, base_code, base_name, category_id, brand_id, line_id, size, color, price, purchase_price, active) VALUES
  ('JEA-002-28A','Jean Recto - 28 - Azul', 'JEA-002','Jean Recto','22222222-0007-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','28','Azul',130,75,true),
  ('JEA-002-30A','Jean Recto - 30 - Azul', 'JEA-002','Jean Recto','22222222-0007-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','30','Azul',130,75,true),
  ('JEA-002-32A','Jean Recto - 32 - Azul', 'JEA-002','Jean Recto','22222222-0007-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','32','Azul',130,75,true),
  ('JEA-002-34A','Jean Recto - 34 - Azul', 'JEA-002','Jean Recto','22222222-0007-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','34','Azul',130,75,true),
  ('JEA-002-28N','Jean Recto - 28 - Negro','JEA-002','Jean Recto','22222222-0007-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','28','Negro',130,75,true),
  ('JEA-002-30N','Jean Recto - 30 - Negro','JEA-002','Jean Recto','22222222-0007-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','30','Negro',130,75,true),
  ('JEA-002-32N','Jean Recto - 32 - Negro','JEA-002','Jean Recto','22222222-0007-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','32','Negro',130,75,true),
  ('JEA-002-28G','Jean Recto - 28 - Gris', 'JEA-002','Jean Recto','22222222-0007-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','28','Gris',130,75,true),
  ('JEA-002-30G','Jean Recto - 30 - Gris', 'JEA-002','Jean Recto','22222222-0007-0000-0000-000000000000','33333333-0002-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','30','Gris',130,75,true);

-- MODEL 9: Casaca Deportiva (CAS-002) — Hombres / Casacas — Adiction
--   Colors: Negro, Azul, Rojo | Sizes: S, M, L, XL
INSERT INTO public.products (barcode, name, base_code, base_name, category_id, brand_id, line_id, size, color, price, purchase_price, active) VALUES
  ('CAS-002-SN','Casaca Deportiva - S - Negro', 'CAS-002','Casaca Deportiva','22222222-0009-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Negro',220,130,true),
  ('CAS-002-MN','Casaca Deportiva - M - Negro', 'CAS-002','Casaca Deportiva','22222222-0009-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Negro',220,130,true),
  ('CAS-002-LN','Casaca Deportiva - L - Negro', 'CAS-002','Casaca Deportiva','22222222-0009-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','L','Negro',220,130,true),
  ('CAS-002-XN','Casaca Deportiva - XL - Negro','CAS-002','Casaca Deportiva','22222222-0009-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','XL','Negro',220,130,true),
  ('CAS-002-SA','Casaca Deportiva - S - Azul',  'CAS-002','Casaca Deportiva','22222222-0009-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Azul',220,130,true),
  ('CAS-002-MA','Casaca Deportiva - M - Azul',  'CAS-002','Casaca Deportiva','22222222-0009-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Azul',220,130,true),
  ('CAS-002-LA','Casaca Deportiva - L - Azul',  'CAS-002','Casaca Deportiva','22222222-0009-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','L','Azul',220,130,true),
  ('CAS-002-SR','Casaca Deportiva - S - Rojo',  'CAS-002','Casaca Deportiva','22222222-0009-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Rojo',220,130,true),
  ('CAS-002-MR','Casaca Deportiva - M - Rojo',  'CAS-002','Casaca Deportiva','22222222-0009-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Rojo',220,130,true);

-- MODEL 10: Pantalón Jogger (PAN-001) — Hombres / Pantalones (using Mujeres Pantalones cat)
--   Colors: Negro, Gris, Verde | Sizes: S, M, L, XL
INSERT INTO public.products (barcode, name, base_code, base_name, category_id, brand_id, line_id, size, color, price, purchase_price, active) VALUES
  ('PAN-001-SN','Pantalón Jogger - S - Negro', 'PAN-001','Pantalón Jogger','22222222-0005-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Negro',85,50,true),
  ('PAN-001-MN','Pantalón Jogger - M - Negro', 'PAN-001','Pantalón Jogger','22222222-0005-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Negro',85,50,true),
  ('PAN-001-LN','Pantalón Jogger - L - Negro', 'PAN-001','Pantalón Jogger','22222222-0005-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','L','Negro',85,50,true),
  ('PAN-001-XN','Pantalón Jogger - XL - Negro','PAN-001','Pantalón Jogger','22222222-0005-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','XL','Negro',85,50,true),
  ('PAN-001-SG','Pantalón Jogger - S - Gris',  'PAN-001','Pantalón Jogger','22222222-0005-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Gris',85,50,true),
  ('PAN-001-MG','Pantalón Jogger - M - Gris',  'PAN-001','Pantalón Jogger','22222222-0005-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Gris',85,50,true),
  ('PAN-001-LG','Pantalón Jogger - L - Gris',  'PAN-001','Pantalón Jogger','22222222-0005-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','L','Gris',85,50,true),
  ('PAN-001-SV','Pantalón Jogger - S - Verde', 'PAN-001','Pantalón Jogger','22222222-0005-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','S','Verde',85,50,true),
  ('PAN-001-MV','Pantalón Jogger - M - Verde', 'PAN-001','Pantalón Jogger','22222222-0005-0000-0000-000000000000','33333333-0001-0000-0000-000000000000','11111111-0002-0000-0000-000000000000','M','Verde',85,50,true);

-- ── 6. Stock (warehouse: "Mujeres" + "Hombres") ───────────────────────────────
-- Insert stock for all products just created
INSERT INTO public.stock (warehouse_id, product_id, quantity)
SELECT
  CASE
    WHEN p.line_id = '11111111-0001-0000-0000-000000000000' THEN 'Mujeres'
    ELSE 'Hombres'
  END AS warehouse_id,
  p.id,
  FLOOR(RANDOM() * 15 + 2)::INTEGER  -- 2 to 16 units
FROM public.products p
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- ── 7. product_images with placeholder URLs (picsum.photos with deterministic seeds)
-- Each model gets one primary image (color IS NULL → model-level).
-- The visual catalog will display these immediately.
INSERT INTO public.product_images (base_code, color, is_primary, storage_bucket, storage_path, public_url, sort_order)
VALUES
  ('BLS-001', NULL, true, 'product-images', 'seed/BLS-001.jpg', 'https://picsum.photos/seed/BLS001/400/533', 0),
  ('JEA-001', NULL, true, 'product-images', 'seed/JEA-001.jpg', 'https://picsum.photos/seed/JEA001/400/533', 0),
  ('VES-001', NULL, true, 'product-images', 'seed/VES-001.jpg', 'https://picsum.photos/seed/VES001/400/533', 0),
  ('CAS-001', NULL, true, 'product-images', 'seed/CAS-001.jpg', 'https://picsum.photos/seed/CAS001/400/533', 0),
  ('CHA-001', NULL, true, 'product-images', 'seed/CHA-001.jpg', 'https://picsum.photos/seed/CHA001/400/533', 0),
  ('POL-001', NULL, true, 'product-images', 'seed/POL-001.jpg', 'https://picsum.photos/seed/POL001/400/533', 0),
  ('CAM-001', NULL, true, 'product-images', 'seed/CAM-001.jpg', 'https://picsum.photos/seed/CAM001/400/533', 0),
  ('JEA-002', NULL, true, 'product-images', 'seed/JEA-002.jpg', 'https://picsum.photos/seed/JEA002/400/533', 0),
  ('CAS-002', NULL, true, 'product-images', 'seed/CAS-002.jpg', 'https://picsum.photos/seed/CAS002/400/533', 0),
  ('PAN-001', NULL, true, 'product-images', 'seed/PAN-001.jpg', 'https://picsum.photos/seed/PAN001/400/533', 0)
ON CONFLICT DO NOTHING;

-- ── Validation queries (uncomment to check) ───────────────────────────────────
-- SELECT base_code, base_name, COUNT(*) AS variants, COUNT(DISTINCT color) AS colors, COUNT(DISTINCT size) AS sizes
-- FROM public.products GROUP BY base_code, base_name ORDER BY base_code;

-- SELECT base_code, COUNT(*) AS images FROM public.product_images GROUP BY base_code;

-- SELECT p.base_code, SUM(s.quantity) AS total_stock
-- FROM public.products p LEFT JOIN public.stock s ON s.product_id = p.id
-- GROUP BY p.base_code ORDER BY p.base_code;
