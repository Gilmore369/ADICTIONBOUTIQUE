-- ============================================================================
-- Migration: 20260224000005_full_seed_transactional.sql
-- Seed completo: stores, warehouses, clients, sales, credits,
--                collection_actions, cash_shifts, tasks, client_ratings
--
-- Requiere: 20260224000004 ejecutado primero (productos deben existir)
-- Fecha:    2026-02-24
-- ============================================================================

-- ── 0. Wipe transactional data in FK-safe order ──────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema='public' AND table_name='route_stops') THEN
    DELETE FROM public.route_stops;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema='public' AND table_name='routes') THEN
    DELETE FROM public.routes;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema='public' AND table_name='tasks') THEN
    DELETE FROM public.tasks;
  END IF;
END $$;

DELETE FROM public.payment_allocations;
DELETE FROM public.payments;
DELETE FROM public.collection_actions;
DELETE FROM public.installments;
DELETE FROM public.credit_plans;
DELETE FROM public.sale_items;
DELETE FROM public.sales;
DELETE FROM public.cash_expenses;
DELETE FROM public.cash_shifts;
DELETE FROM public.client_action_logs;
DELETE FROM public.client_deactivations;
DELETE FROM public.client_ratings;
DELETE FROM public.clients;

-- ── 1. Stores & Warehouses ───────────────────────────────────────────────────

INSERT INTO public.stores (id, code, name, address, active) VALUES
  ('aaaa0001-0000-0000-0000-000000000000', 'MUJERES', 'Adiction Boutique – Mujeres', 'Jr. Carabaya 455, Cercado de Lima',  true),
  ('aaaa0002-0000-0000-0000-000000000000', 'HOMBRES', 'Adiction Boutique – Hombres', 'Jr. Carabaya 457, Cercado de Lima',  true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name, address = EXCLUDED.address, active = true;

INSERT INTO public.warehouses (store_id, name, active)
SELECT id, 'Almacén Principal', true FROM public.stores WHERE code = 'MUJERES'
ON CONFLICT (store_id, name) DO UPDATE SET active = true;

INSERT INTO public.warehouses (store_id, name, active)
SELECT id, 'Almacén Principal', true FROM public.stores WHERE code = 'HOMBRES'
ON CONFLICT (store_id, name) DO UPDATE SET active = true;

-- ── 2. Clients (15 clientes peruanos realistas) ───────────────────────────────

INSERT INTO public.clients
  (id, dni, name, phone, email, address, lat, lng,
   credit_limit, credit_used, rating, active, created_at)
VALUES
  -- Clientes A (buena calificación, sin deuda) — Trujillo, La Libertad
  ('cc000001-0000-0000-0000-000000000000','45123789','María García López',
   '987654321','maria.garcia@gmail.com','Av. España 234, Centro Histórico',
    -8.1067,-79.0266, 1500.00,    0.00,'A',true, NOW()-INTERVAL '180 days'),

  ('cc000004-0000-0000-0000-000000000000','74852362','Carlos Mendoza Rivas',
   '954321098','cmendoza@yahoo.com','Calle Los Laureles 12, Miraflores',
    -8.1047,-79.0232, 3000.00,    0.00,'A',true, NOW()-INTERVAL '150 days'),

  ('cc000007-0000-0000-0000-000000000000','07185611','Lucía Fernández Vega',
   '921098765','lucia.fvega@gmail.com','Av. América Norte 456, Trujillo',
    -8.0980,-79.0261, 2500.00,    0.00,'A',true, NOW()-INTERVAL '120 days'),

  ('cc000010-0000-0000-0000-000000000000','30418944','Luis Alberto Chávez',
   '988765432','lchavez@gmail.com','Jr. Independencia 901, Centro Trujillo',
    -8.1120,-79.0270, 4000.00,    0.00,'A',true, NOW()-INTERVAL '200 days'),

  ('cc000013-0000-0000-0000-000000000000','63741201','Patricia Lima Cárdenas',
   '955432109','patricia.lima@gmail.com','Av. Fátima 789, El Porvenir',
    -8.0668,-79.0006, 2200.00,    0.00,'A',true, NOW()-INTERVAL '90 days'),

  ('cc000015-0000-0000-0000-000000000000','85963400','Elena Pacheco Flores',
   '933210987','elena.pacheco@gmail.com','Av. Víctor Larco 567, Víctor Larco',
    -8.1378,-79.0428, 1100.00,    0.00,'A',true, NOW()-INTERVAL '60 days'),

  -- Clientes B (historial moderado, algo de deuda)
  ('cc000002-0000-0000-0000-000000000000','52634190','Juan Carlos Quispe',
   '976543210','jcquispe@hotmail.com','Jr. Pizarro 456, Centro Trujillo',
    -8.1105,-79.0282, 2000.00,    0.00,'B',true, NOW()-INTERVAL '140 days'),

  ('cc000005-0000-0000-0000-000000000000','85963471','Ana Sofía Torres',
   '943210987','ana.torres@gmail.com','Av. Húsares de Junín 567, La Esperanza',
    -8.0778,-79.0500, 1200.00,    0.00,'B',true, NOW()-INTERVAL '100 days'),

  ('cc000011-0000-0000-0000-000000000000','41529063','Sandra Valeria Ruiz',
   '977654321','sandra.ruiz@gmail.com','Av. Mansiche 123, Urb. Los Granados',
    -8.1100,-79.0350, 1500.00,    0.00,'B',true, NOW()-INTERVAL '110 days'),

  ('cc000014-0000-0000-0000-000000000000','74852399','Miguel Ángel Ccori',
   '944321098','miguel.ccori@hotmail.com','Jr. San Martín 234, Centro Trujillo',
    -8.1089,-79.0245,  900.00,    0.00,'B',true, NOW()-INTERVAL '80 days'),

  -- Clientes C (con deuda parcial)
  ('cc000008-0000-0000-0000-000000000000','18296730','Roberto Salas Puma',
   '910987654','rsalas@hotmail.com','Calle Ayacucho 345, Florencia de Mora',
    -8.0842,-79.0094,  500.00,    0.00,'C',true, NOW()-INTERVAL '130 days'),

  ('cc000009-0000-0000-0000-000000000000','29307841','Carmen Rosa Apaza',
   '999876543','carmen.apaza@gmail.com','Av. Universitaria 678, La Esperanza',
    -8.0800,-79.0480, 1800.00,    0.00,'C',true, NOW()-INTERVAL '95 days'),

  -- Clientes con deuda alta / mora
  ('cc000003-0000-0000-0000-000000000000','63741285','Rosa Elena Mamani',
   '965432109','rosa.mamani@gmail.com','Av. Perú 789, La Esperanza',
    -8.0730,-79.0520,  800.00,    0.00,'C',true, NOW()-INTERVAL '160 days'),

  ('cc000006-0000-0000-0000-000000000000','96074518','Pedro Huamaní Ccori',
   '932109876','phuamani@gmail.com','Jr. Orbegoso 890, Centro Trujillo',
    -8.1130,-79.0278, 1000.00,    0.00,'D',true, NOW()-INTERVAL '170 days'),

  ('cc000012-0000-0000-0000-000000000000','52630174','Jorge Luis Medina',
   '966543210','jorge.medina@yahoo.com','Calle Bolívar 456, Miraflores Trujillo',
    -8.1050,-79.0218,  600.00,    0.00,'D',true, NOW()-INTERVAL '85 days')

ON CONFLICT (dni) DO UPDATE
  SET name=EXCLUDED.name, phone=EXCLUDED.phone, email=EXCLUDED.email,
      active=true;

-- ── 3. Sales (8 contado + 4 crédito) ─────────────────────────────────────────
-- sale_type: 'CONTADO' | 'CREDITO'
-- payment_status: 'PAID' | 'PENDING' | 'PARTIAL'

INSERT INTO public.sales
  (id, sale_number, store_id, store_uuid, client_id, user_id,
   sale_type, subtotal, discount, total, payment_status, created_at)
VALUES
  -- CONTADO sales (todas pagadas)
  ('dd000001-0000-0000-0000-000000000000','V-0001','Mujeres',
   (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
   'cc000001-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CONTADO',155.00,0,155.00,'PAID', NOW()-INTERVAL '30 days'),

  ('dd000002-0000-0000-0000-000000000000','V-0002','Hombres',
   (SELECT id FROM public.stores WHERE code='HOMBRES' LIMIT 1),
   'cc000004-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CONTADO',95.00,0,95.00,'PAID', NOW()-INTERVAL '25 days'),

  ('dd000003-0000-0000-0000-000000000000','V-0003','Mujeres',
   (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
   'cc000007-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CONTADO',350.00,0,350.00,'PAID', NOW()-INTERVAL '20 days'),

  ('dd000004-0000-0000-0000-000000000000','V-0004','Hombres',
   (SELECT id FROM public.stores WHERE code='HOMBRES' LIMIT 1),
   'cc000010-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CONTADO',260.00,0,260.00,'PAID', NOW()-INTERVAL '15 days'),

  ('dd000005-0000-0000-0000-000000000000','V-0005','Hombres',
   (SELECT id FROM public.stores WHERE code='HOMBRES' LIMIT 1),
   'cc000002-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CONTADO',120.00,0,120.00,'PAID', NOW()-INTERVAL '10 days'),

  ('dd000006-0000-0000-0000-000000000000','V-0006','Mujeres',
   (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
   'cc000013-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CONTADO',330.00,0,330.00,'PAID', NOW()-INTERVAL '7 days'),

  ('dd000007-0000-0000-0000-000000000000','V-0007','Mujeres',
   (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
   'cc000015-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CONTADO',130.00,0,130.00,'PAID', NOW()-INTERVAL '5 days'),

  ('dd000008-0000-0000-0000-000000000000','V-0008','Mujeres',
   (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
   'cc000001-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CONTADO',175.00,0,175.00,'PAID', NOW()-INTERVAL '2 days'),

  -- CREDITO sales
  -- S9: Rosa Mamani — hace 75 días, todas las cuotas en mora
  ('dd000009-0000-0000-0000-000000000000','V-0009','Mujeres',
   (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
   'cc000003-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CREDITO',800.00,0,800.00,'PENDING', NOW()-INTERVAL '75 days'),

  -- S10: Pedro Huamaní — hace 60 días, 1 cuota pagada, 1 en mora, 1 pendiente
  ('dd000010-0000-0000-0000-000000000000','V-0010','Hombres',
   (SELECT id FROM public.stores WHERE code='HOMBRES' LIMIT 1),
   'cc000006-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CREDITO',1000.00,50,950.00,'PARTIAL', NOW()-INTERVAL '60 days'),

  -- S11: Carmen Apaza — hace 30 días, 1 cuota pagada, 1 parcial, 1 pendiente
  ('dd000011-0000-0000-0000-000000000000','V-0011','Mujeres',
   (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
   'cc000009-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CREDITO',600.00,0,600.00,'PARTIAL', NOW()-INTERVAL '30 days'),

  -- S12: Sandra Ruiz — hace 15 días, todas pendientes
  ('dd000012-0000-0000-0000-000000000000','V-0012','Mujeres',
   (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
   'cc000011-0000-0000-0000-000000000000',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'CREDITO',750.00,5,745.00,'PENDING', NOW()-INTERVAL '15 days');

-- ── 4. Sale Items ─────────────────────────────────────────────────────────────

INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, subtotal)
VALUES
  -- V-0001: María García (2 blusas + 1 polo)
  ('dd000001-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='BLS-001-MR' LIMIT 1),2,55.00,110.00),
  ('dd000001-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='POL-001-MN' LIMIT 1),1,45.00, 45.00),

  -- V-0002: Carlos Mendoza (1 camisa)
  ('dd000002-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='CAM-001-MB' LIMIT 1),1,95.00, 95.00),

  -- V-0003: Lucía Fernández (1 chaleco army)
  ('dd000003-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='CHA-001-MV' LIMIT 1),1,350.00,350.00),

  -- V-0004: Luis Chávez (2 jeans hombre)
  ('dd000004-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='JEA-002-32A' LIMIT 1),1,130.00,130.00),
  ('dd000004-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='JEA-002-30N' LIMIT 1),1,130.00,130.00),

  -- V-0005: Juan Quispe (1 jean skinny)
  ('dd000005-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='JEA-001-30A' LIMIT 1),1,120.00,120.00),

  -- V-0006: Patricia Lima (vestido + casaca denim)
  ('dd000006-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='VES-001-MR' LIMIT 1),1,150.00,150.00),
  ('dd000006-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='CAS-001-MA' LIMIT 1),1,180.00,180.00),

  -- V-0007: Elena Pacheco (jogger + polo)
  ('dd000007-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='PAN-001-MN' LIMIT 1),1,85.00, 85.00),
  ('dd000007-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='POL-001-SG' LIMIT 1),1,45.00, 45.00),

  -- V-0008: María García (jean + blusa)
  ('dd000008-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='JEA-001-32A' LIMIT 1),1,120.00,120.00),
  ('dd000008-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='BLS-001-SB' LIMIT 1),1,55.00, 55.00),

  -- V-0009: Rosa Mamani CRÉDITO (chaleco + casaca + vestido + jean)
  ('dd000009-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='CHA-001-LV'  LIMIT 1),1,350.00,350.00),
  ('dd000009-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='CAS-001-LA'  LIMIT 1),1,180.00,180.00),
  ('dd000009-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='VES-001-MN'  LIMIT 1),1,150.00,150.00),
  ('dd000009-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='JEA-001-30A' LIMIT 1),1,120.00,120.00),

  -- V-0010: Pedro Huamaní CRÉDITO (casacas deportivas + jeans)
  ('dd000010-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='CAS-002-LA'  LIMIT 1),2,220.00,440.00),
  ('dd000010-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='JEA-002-34A' LIMIT 1),2,130.00,260.00),
  ('dd000010-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='CAM-001-MB'  LIMIT 1),1, 95.00, 95.00),
  -- descuento de 50 aplicado a nivel de venta

  -- V-0011: Carmen Apaza CRÉDITO (casaca + vestido + jean)
  ('dd000011-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='CAS-001-MA'  LIMIT 1),1,180.00,180.00),
  ('dd000011-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='VES-001-LN'  LIMIT 1),2,150.00,300.00),
  ('dd000011-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='JEA-001-32A' LIMIT 1),1,120.00,120.00),

  -- V-0012: Sandra Ruiz CRÉDITO (2 chalecos + blusa)
  ('dd000012-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='CHA-001-MN'  LIMIT 1),2,350.00,700.00),
  ('dd000012-0000-0000-0000-000000000000',(SELECT id FROM public.products WHERE barcode='BLS-001-SA'  LIMIT 1),1, 55.00, 55.00);
  -- descuento de 5 → total 745

-- ── 5. Credit Plans ───────────────────────────────────────────────────────────

INSERT INTO public.credit_plans
  (id, sale_id, client_id, total_amount, installments_count, installment_amount, status, created_at)
VALUES
  -- CP1: Rosa Mamani — 800 / 3 cuotas de ~266.67
  ('ee000001-0000-0000-0000-000000000000',
   'dd000009-0000-0000-0000-000000000000',
   'cc000003-0000-0000-0000-000000000000',
   800.00, 3, 266.67, 'ACTIVE', NOW()-INTERVAL '75 days'),

  -- CP2: Pedro Huamaní — 950 / 3 cuotas de ~316.67
  ('ee000002-0000-0000-0000-000000000000',
   'dd000010-0000-0000-0000-000000000000',
   'cc000006-0000-0000-0000-000000000000',
   950.00, 3, 316.67, 'ACTIVE', NOW()-INTERVAL '60 days'),

  -- CP3: Carmen Apaza — 600 / 3 cuotas de 200
  ('ee000003-0000-0000-0000-000000000000',
   'dd000011-0000-0000-0000-000000000000',
   'cc000009-0000-0000-0000-000000000000',
   600.00, 3, 200.00, 'ACTIVE', NOW()-INTERVAL '30 days'),

  -- CP4: Sandra Ruiz — 745 / 3 cuotas de ~248.33
  ('ee000004-0000-0000-0000-000000000000',
   'dd000012-0000-0000-0000-000000000000',
   'cc000011-0000-0000-0000-000000000000',
   745.00, 3, 248.33, 'ACTIVE', NOW()-INTERVAL '15 days');

-- ── 6. Installments ───────────────────────────────────────────────────────────
-- Hoy: 2026-02-24
-- OVERDUE = vencida sin pagar | PAID = pagada | PARTIAL = pagada parcialmente | PENDING = futura

INSERT INTO public.installments
  (id, plan_id, installment_number, amount, due_date, paid_amount, status)
VALUES
  -- CP1 (Rosa Mamani) – Venta: 2025-11-10 → vencimientos mensuales
  ('ff010001-0000-0000-0000-000000000000','ee000001-0000-0000-0000-000000000000',
   1, 266.67, '2025-12-10', 0.00, 'OVERDUE'),
  ('ff010002-0000-0000-0000-000000000000','ee000001-0000-0000-0000-000000000000',
   2, 266.67, '2026-01-10', 0.00, 'OVERDUE'),
  ('ff010003-0000-0000-0000-000000000000','ee000001-0000-0000-0000-000000000000',
   3, 266.66, '2026-02-10', 0.00, 'OVERDUE'),

  -- CP2 (Pedro Huamaní) – Venta: 2025-12-25 → 1ª cuota pagada
  ('ff020001-0000-0000-0000-000000000000','ee000002-0000-0000-0000-000000000000',
   1, 316.67, '2026-01-25', 316.67,'PAID'),
  ('ff020002-0000-0000-0000-000000000000','ee000002-0000-0000-0000-000000000000',
   2, 316.67, '2026-02-25',   0.00,'OVERDUE'),
  ('ff020003-0000-0000-0000-000000000000','ee000002-0000-0000-0000-000000000000',
   3, 316.66, '2026-03-25',   0.00,'PENDING'),

  -- CP3 (Carmen Apaza) – Venta: 2026-01-25 → 1ª pagada, 2ª parcial
  ('ff030001-0000-0000-0000-000000000000','ee000003-0000-0000-0000-000000000000',
   1, 200.00, '2026-02-25', 200.00,'PAID'),
  ('ff030002-0000-0000-0000-000000000000','ee000003-0000-0000-0000-000000000000',
   2, 200.00, '2026-03-25', 100.00,'PARTIAL'),
  ('ff030003-0000-0000-0000-000000000000','ee000003-0000-0000-0000-000000000000',
   3, 200.00, '2026-04-25',   0.00,'PENDING'),

  -- CP4 (Sandra Ruiz) – Venta: 2026-02-09 → todas pendientes
  ('ff040001-0000-0000-0000-000000000000','ee000004-0000-0000-0000-000000000000',
   1, 248.33, '2026-03-09',   0.00,'PENDING'),
  ('ff040002-0000-0000-0000-000000000000','ee000004-0000-0000-0000-000000000000',
   2, 248.33, '2026-04-09',   0.00,'PENDING'),
  ('ff040003-0000-0000-0000-000000000000','ee000004-0000-0000-0000-000000000000',
   3, 248.34, '2026-05-09',   0.00,'PENDING');

-- ── 7. Payments (pagos realizados) ───────────────────────────────────────────

INSERT INTO public.payments
  (id, client_id, installment_id, plan_id, amount, payment_date, user_id, notes, created_at)
VALUES
  -- P1: Pedro paga su 1ª cuota completa (2026-01-20)
  ('ab000001-0000-0000-0000-000000000000',
   'cc000006-0000-0000-0000-000000000000',
   'ff020001-0000-0000-0000-000000000000',
   'ee000002-0000-0000-0000-000000000000',
   316.67, '2026-01-20',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'Pago en tienda – efectivo', NOW()-INTERVAL '35 days'),

  -- P2: Carmen paga su 1ª cuota completa (2026-02-23)
  ('ab000002-0000-0000-0000-000000000000',
   'cc000009-0000-0000-0000-000000000000',
   'ff030001-0000-0000-0000-000000000000',
   'ee000003-0000-0000-0000-000000000000',
   200.00, '2026-02-23',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'Pago en tienda – Yape', NOW()-INTERVAL '1 day'),

  -- P3: Carmen abona 100 a su 2ª cuota (2026-02-24)
  ('ab000003-0000-0000-0000-000000000000',
   'cc000009-0000-0000-0000-000000000000',
   'ff030002-0000-0000-0000-000000000000',
   'ee000003-0000-0000-0000-000000000000',
   100.00, '2026-02-24',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   'Abono parcial – Plin', NOW());

-- ── 8. Payment Allocations ────────────────────────────────────────────────────

INSERT INTO public.payment_allocations
  (payment_id, installment_id, amount_applied)
VALUES
  ('ab000001-0000-0000-0000-000000000000','ff020001-0000-0000-0000-000000000000',316.67),
  ('ab000002-0000-0000-0000-000000000000','ff030001-0000-0000-0000-000000000000',200.00),
  ('ab000003-0000-0000-0000-000000000000','ff030002-0000-0000-0000-000000000000',100.00)
ON CONFLICT (payment_id, installment_id) DO NOTHING;

-- ── 9. Collection Actions ─────────────────────────────────────────────────────
-- action_type: LLAMADA|VISITA|WHATSAPP|MENSAJE_SMS|EMAIL|MOTORIZADO|CARTA_NOTARIAL|OTRO
-- result:      COMPROMISO_PAGO|PROMETE_PAGAR_FECHA|PAGO_REALIZADO|PAGO_PARCIAL|
--              CLIENTE_COLABORADOR|SE_NIEGA_PAGAR|NO_CONTESTA|TELEFONO_INVALIDO|
--              CLIENTE_MOLESTO|DOMICILIO_INCORRECTO|CLIENTE_NO_UBICADO|OTRO|etc.

INSERT INTO public.collection_actions
  (id, client_id, client_name, action_type, result,
   payment_promise_date, notes, follow_up_date, completed,
   user_id, created_at)
VALUES
  -- Rosa Mamani (3 cuotas en mora desde noviembre)
  ('ac000001-0000-0000-0000-000000000000',
   'cc000003-0000-0000-0000-000000000000','Rosa Elena Mamani',
   'LLAMADA','NO_CONTESTA',
   NULL,'No responde al teléfono, 3 intentos','2026-02-20',false,
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '10 days'),

  ('ac000002-0000-0000-0000-000000000000',
   'cc000003-0000-0000-0000-000000000000','Rosa Elena Mamani',
   'VISITA','CLIENTE_NO_UBICADO',
   NULL,'No se encontró en el domicilio registrado. Vecinos no saben de ella.',
   '2026-02-22',false,
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '7 days'),

  ('ac000003-0000-0000-0000-000000000000',
   'cc000003-0000-0000-0000-000000000000','Rosa Elena Mamani',
   'WHATSAPP','PROMETE_PAGAR_FECHA',
   '2026-03-01','Respondió por WhatsApp. Dice que pagará el 1 de marzo.','2026-03-02',false,
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '3 days'),

  -- Pedro Huamaní (2ª cuota vence mañana)
  ('ac000004-0000-0000-0000-000000000000',
   'cc000006-0000-0000-0000-000000000000','Pedro Huamaní Ccori',
   'LLAMADA','CLIENTE_MOLESTO',
   NULL,'Cliente alterado, dice que ya pagó. Se le explicó que falta la 2ª cuota.','2026-02-26',false,
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '5 days'),

  ('ac000005-0000-0000-0000-000000000000',
   'cc000006-0000-0000-0000-000000000000','Pedro Huamaní Ccori',
   'WHATSAPP','PROMETE_PAGAR_FECHA',
   '2026-02-28','Acordó pagar el viernes 28 vía transferencia.','2026-03-01',false,
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '2 days'),

  -- Carmen Apaza (hizo pagos, gestión de seguimiento)
  ('ac000006-0000-0000-0000-000000000000',
   'cc000009-0000-0000-0000-000000000000','Carmen Rosa Apaza',
   'LLAMADA','PAGO_PARCIAL',
   NULL,'Realizó abono de S/100 hoy. Confirma pago del saldo en 2 semanas.','2026-03-10',false,
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()),

  -- Sandra Ruiz (plan nuevo, llamada preventiva)
  ('ac000007-0000-0000-0000-000000000000',
   'cc000011-0000-0000-0000-000000000000','Sandra Valeria Ruiz',
   'LLAMADA','COMPROMISO_PAGO',
   '2026-03-09','Confirmó que pagará su primera cuota puntual el 9 de marzo.','2026-03-10',false,
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '3 days'),

  -- Jorge Medina (sin deuda activa, seguimiento preventivo)
  ('ac000008-0000-0000-0000-000000000000',
   'cc000012-0000-0000-0000-000000000000','Jorge Luis Medina',
   'LLAMADA','CLIENTE_COLABORADOR',
   NULL,'Llamada de seguimiento. Cliente interesado en próxima campaña.', NULL, true,
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '8 days'),

  -- Roberto Salas (seguimiento leve)
  ('ac000009-0000-0000-0000-000000000000',
   'cc000008-0000-0000-0000-000000000000','Roberto Salas Puma',
   'MENSAJE_SMS','CLIENTE_COLABORADOR',
   NULL,'Envío de recordatorio SMS. Respondió confirmando visita a la tienda.', NULL, true,
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '4 days'),

  -- Ana Torres (interesada en crédito)
  ('ac000010-0000-0000-0000-000000000000',
   'cc000005-0000-0000-0000-000000000000','Ana Sofía Torres',
   'LLAMADA','COMPROMISO_PAGO',
   NULL,'Interesada en plan de crédito para próxima compra. Se le informó condiciones.', NULL, true,
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '6 days');

-- ── 10. Cash Shifts & Expenses ────────────────────────────────────────────────

INSERT INTO public.cash_shifts
  (id, store_id, store_uuid, user_id,
   opening_amount, closing_amount, expected_amount, difference,
   opened_at, closed_at, status)
VALUES
  -- Turno 1: Hace 3 días (cerrado)
  ('ad000001-0000-0000-0000-000000000000',
   'Mujeres',
   (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   500.00, 2785.00, 2800.00, -15.00,
   NOW()-INTERVAL '3 days'+ TIME '08:00',
   NOW()-INTERVAL '3 days'+ TIME '20:00',
   'CLOSED'),

  -- Turno 2: Hace 2 días (cerrado)
  ('ad000002-0000-0000-0000-000000000000',
   'Mujeres',
   (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   500.00, 1820.00, 1800.00, 20.00,
   NOW()-INTERVAL '2 days'+ TIME '08:00',
   NOW()-INTERVAL '2 days'+ TIME '20:00',
   'CLOSED'),

  -- Turno 3: Hoy (abierto)
  ('ad000003-0000-0000-0000-000000000000',
   'Mujeres',
   (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   500.00, 0.00, 0.00, 0.00,
   NOW()+ TIME '08:00',
   NULL,
   'OPEN');

INSERT INTO public.cash_expenses
  (shift_id, amount, category, description, user_id, created_at)
VALUES
  -- Turno 1 expenses
  ('ad000001-0000-0000-0000-000000000000', 30.00,'MOVILIDAD',
   'Taxi para entrega de mercadería',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '3 days'+ TIME '10:00'),
  ('ad000001-0000-0000-0000-000000000000', 80.00,'SERVICIOS',
   'Pago de internet mensual',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '3 days'+ TIME '12:00'),
  ('ad000001-0000-0000-0000-000000000000', 25.00,'OTROS',
   'Compra de útiles de oficina',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '3 days'+ TIME '15:00'),

  -- Turno 2 expenses
  ('ad000002-0000-0000-0000-000000000000', 45.00,'LIMPIEZA',
   'Productos de limpieza del local',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '2 days'+ TIME '09:00'),
  ('ad000002-0000-0000-0000-000000000000', 20.00,'MOVILIDAD',
   'Pasajes para cobranza',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '2 days'+ TIME '11:00'),
  ('ad000002-0000-0000-0000-000000000000', 15.00,'OTROS',
   'Almuerzo vendedor',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()-INTERVAL '2 days'+ TIME '13:00'),

  -- Turno 3 (hoy)
  ('ad000003-0000-0000-0000-000000000000', 25.00,'MOVILIDAD',
   'Pasajes cobranza zona norte',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
   NOW()+ TIME '09:30');

-- ── 11. Tasks (tareas de cobranza asignadas) ──────────────────────────────────
-- task_type: COBRANZA|ENTREGA|VISITA|OTRO
-- status:    PENDING|IN_PROGRESS|DONE|CANCELLED
-- priority:  1 (baja) a 5 (urgente)

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema='public' AND table_name='tasks') THEN
    INSERT INTO public.tasks
      (id, store_id, client_id, task_type, assigned_to, scheduled_date,
       status, priority, notes, plan_id, created_by, created_at)
    VALUES
      -- Cobranza urgente: Rosa Mamani (3 cuotas en mora)
      ('ae000001-0000-0000-0000-000000000000',
       (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
       'cc000003-0000-0000-0000-000000000000',
       'COBRANZA',
       (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
       CURRENT_DATE, 'PENDING', 5,
       'URGENTE: Rosa Mamani con 3 cuotas vencidas. Prometió pagar el 01/03.',
       'ee000001-0000-0000-0000-000000000000',
       (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
       NOW()-INTERVAL '1 day'),

      -- Cobranza: Pedro Huamaní (cuota vence mañana)
      ('ae000002-0000-0000-0000-000000000000',
       (SELECT id FROM public.stores WHERE code='HOMBRES' LIMIT 1),
       'cc000006-0000-0000-0000-000000000000',
       'COBRANZA',
       (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
       CURRENT_DATE + 1, 'PENDING', 4,
       'Cuota de S/316.67 vence el 25/02. Acordó pagar el 28/02.',
       'ee000002-0000-0000-0000-000000000000',
       (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
       NOW()-INTERVAL '2 days'),

      -- Seguimiento: Carmen Apaza (2ª cuota en proceso)
      ('ae000003-0000-0000-0000-000000000000',
       (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
       'cc000009-0000-0000-0000-000000000000',
       'COBRANZA',
       (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
       CURRENT_DATE + 7, 'PENDING', 2,
       'Seguimiento 2ª cuota. Abonó S/100, saldo S/100 pendiente.',
       'ee000003-0000-0000-0000-000000000000',
       (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
       NOW()),

      -- Visita: Rosa Mamani (domicilio)
      ('ae000004-0000-0000-0000-000000000000',
       (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
       'cc000003-0000-0000-0000-000000000000',
       'VISITA',
       (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
       CURRENT_DATE + 2, 'PENDING', 5,
       'Visita domiciliaria: Av. Brasil 789, Breña. Anterior visita sin éxito.',
       'ee000001-0000-0000-0000-000000000000',
       (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
       NOW()),

      -- Cobranza preventiva: Sandra Ruiz (1ª cuota el 09/03)
      ('ae000005-0000-0000-0000-000000000000',
       (SELECT id FROM public.stores WHERE code='MUJERES' LIMIT 1),
       'cc000011-0000-0000-0000-000000000000',
       'COBRANZA',
       (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
       '2026-03-07', 'PENDING', 1,
       'Recordatorio preventivo antes del vencimiento 09/03.',
       'ee000004-0000-0000-0000-000000000000',
       (SELECT id FROM public.users ORDER BY created_at LIMIT 1),
       NOW());
  END IF;
END $$;

-- ── 12. Client Ratings ───────────────────────────────────────────────────────
-- rating: 'A'|'B'|'C'|'D'  (usa el ENUM rating_category)

INSERT INTO public.client_ratings
  (client_id, rating, score, payment_punctuality,
   purchase_frequency, total_purchases, client_tenure_days, last_calculated)
VALUES
  ('cc000001-0000-0000-0000-000000000000','A',95, 98,85,6,180, NOW()),
  ('cc000004-0000-0000-0000-000000000000','A',92, 95,80,5,150, NOW()),
  ('cc000007-0000-0000-0000-000000000000','A',90, 92,75,4,120, NOW()),
  ('cc000010-0000-0000-0000-000000000000','A',88, 90,70,7,200, NOW()),
  ('cc000013-0000-0000-0000-000000000000','A',85, 88,65,3, 90, NOW()),
  ('cc000002-0000-0000-0000-000000000000','B',72, 75,60,4,140, NOW()),
  ('cc000005-0000-0000-0000-000000000000','B',70, 72,58,3,100, NOW()),
  ('cc000011-0000-0000-0000-000000000000','B',68, 70,55,4,110, NOW()),
  ('cc000009-0000-0000-0000-000000000000','C',55, 58,45,3, 95, NOW()),
  ('cc000008-0000-0000-0000-000000000000','C',50, 52,40,2,130, NOW()),
  ('cc000003-0000-0000-0000-000000000000','C',40, 30,35,3,160, NOW()),
  ('cc000006-0000-0000-0000-000000000000','D',28, 20,30,4,170, NOW()),
  ('cc000012-0000-0000-0000-000000000000','D',30, 22,25,2, 85, NOW())
ON CONFLICT (client_id) DO UPDATE
  SET rating=EXCLUDED.rating, score=EXCLUDED.score,
      payment_punctuality=EXCLUDED.payment_punctuality,
      last_calculated=NOW();

-- ── 13. Client Action Logs (notas y llamadas de gestión CRM) ─────────────────
-- action_type ENUM: NOTA|LLAMADA|VISITA|MENSAJE|REACTIVACION

INSERT INTO public.client_action_logs
  (client_id, action_type, description, user_id, created_at)
VALUES
  ('cc000001-0000-0000-0000-000000000000','NOTA',
   'Cliente VIP recurrente. Prefiere ser contactada por WhatsApp.',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1), NOW()-INTERVAL '20 days'),

  ('cc000003-0000-0000-0000-000000000000','LLAMADA',
   'Intento de cobranza. No atendió el teléfono.',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1), NOW()-INTERVAL '10 days'),

  ('cc000003-0000-0000-0000-000000000000','VISITA',
   'Visita al domicilio. Cliente no encontrada.',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1), NOW()-INTERVAL '7 days'),

  ('cc000006-0000-0000-0000-000000000000','LLAMADA',
   'Cliente con actitud hostil al ser contactado. Requiere seguimiento delicado.',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1), NOW()-INTERVAL '5 days'),

  ('cc000010-0000-0000-0000-000000000000','NOTA',
   'Interesado en colección de temporada. Reserva pre-venta.',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1), NOW()-INTERVAL '3 days'),

  ('cc000015-0000-0000-0000-000000000000','NOTA',
   'Cliente nueva con buen historial. Referida por María García.',
   (SELECT id FROM public.users ORDER BY created_at LIMIT 1), NOW()-INTERVAL '60 days');

-- ── Validación (descomentar para verificar) ───────────────────────────────────
-- SELECT 'clients'         AS tabla, COUNT(*) AS total FROM public.clients;
-- SELECT 'sales'           AS tabla, COUNT(*) AS total FROM public.sales;
-- SELECT 'sale_items'      AS tabla, COUNT(*) AS total FROM public.sale_items;
-- SELECT 'credit_plans'    AS tabla, COUNT(*) AS total FROM public.credit_plans;
-- SELECT 'installments'    AS tabla, COUNT(*) AS total FROM public.installments;
-- SELECT 'payments'        AS tabla, COUNT(*) AS total FROM public.payments;
-- SELECT 'collection_actions' AS tabla, COUNT(*) AS total FROM public.collection_actions;
-- SELECT 'cash_shifts'     AS tabla, COUNT(*) AS total FROM public.cash_shifts;
-- SELECT 'cash_expenses'   AS tabla, COUNT(*) AS total FROM public.cash_expenses;
-- SELECT 'client_ratings'  AS tabla, COUNT(*) AS total FROM public.client_ratings;
-- SELECT 'client_action_logs' AS tabla, COUNT(*) AS total FROM public.client_action_logs;
