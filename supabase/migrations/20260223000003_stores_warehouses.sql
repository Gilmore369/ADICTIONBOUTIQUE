-- ============================================================================
-- Migration: Stores & Warehouses - Normalizar TEXT a UUID FKs
-- ============================================================================
-- Crea tablas maestras y migra store_id/warehouse_id de TEXT a UUID.
-- Mantiene columnas *_old como backup hasta validación.
-- ============================================================================

-- ============================================================================
-- 1. TABLA STORES
-- ============================================================================
CREATE TABLE IF NOT EXISTS stores (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code    TEXT UNIQUE NOT NULL,          -- 'MUJERES', 'HOMBRES'
  name    TEXT NOT NULL,
  address TEXT,
  lat     NUMERIC(10,8),
  lng     NUMERIC(11,8),
  active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar sedes base (idempotente)
INSERT INTO stores (code, name) VALUES
  ('MUJERES', 'Adiction Boutique Mujeres'),
  ('HOMBRES', 'Adiction Boutique Hombres')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. TABLA WAREHOUSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id),
  name     TEXT NOT NULL,
  active   BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, name)
);

-- Crear almacén principal por cada sede
INSERT INTO warehouses (store_id, name)
SELECT s.id, 'Almacén Principal'
FROM stores s
ON CONFLICT (store_id, name) DO NOTHING;

-- ============================================================================
-- 3. MIGRAR sales.store_id (TEXT → UUID)
-- ============================================================================

-- Backup
ALTER TABLE sales ADD COLUMN IF NOT EXISTS store_id_old TEXT;
UPDATE sales SET store_id_old = store_id WHERE store_id_old IS NULL;

-- Agregar nueva columna UUID
ALTER TABLE sales ADD COLUMN IF NOT EXISTS store_uuid UUID REFERENCES stores(id);

-- Mapear valores existentes
UPDATE sales s
SET store_uuid = st.id
FROM stores st
WHERE UPPER(TRIM(s.store_id)) = UPPER(TRIM(st.code))
   OR UPPER(TRIM(s.store_id)) LIKE '%' || UPPER(TRIM(st.code)) || '%'
   OR UPPER(TRIM(st.name)) LIKE '%' || UPPER(TRIM(s.store_id)) || '%';

-- Fallback: asignar MUJERES a los que queden NULL (no debería ocurrir con datos limpios)
UPDATE sales
SET store_uuid = (SELECT id FROM stores WHERE code = 'MUJERES' LIMIT 1)
WHERE store_uuid IS NULL AND store_id IS NOT NULL;

-- ============================================================================
-- 4. MIGRAR cash_shifts.store_id (TEXT → UUID)
-- ============================================================================

ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS store_id_old TEXT;
UPDATE cash_shifts SET store_id_old = store_id WHERE store_id_old IS NULL;

ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS store_uuid UUID REFERENCES stores(id);

UPDATE cash_shifts cs
SET store_uuid = st.id
FROM stores st
WHERE UPPER(TRIM(cs.store_id)) = UPPER(TRIM(st.code))
   OR UPPER(TRIM(cs.store_id)) LIKE '%' || UPPER(TRIM(st.code)) || '%'
   OR UPPER(TRIM(st.name)) LIKE '%' || UPPER(TRIM(cs.store_id)) || '%';

UPDATE cash_shifts
SET store_uuid = (SELECT id FROM stores WHERE code = 'MUJERES' LIMIT 1)
WHERE store_uuid IS NULL AND store_id IS NOT NULL;

-- ============================================================================
-- 5. MIGRAR stock.warehouse_id (TEXT → UUID)
-- ============================================================================

ALTER TABLE stock ADD COLUMN IF NOT EXISTS warehouse_id_old TEXT;
UPDATE stock SET warehouse_id_old = warehouse_id WHERE warehouse_id_old IS NULL;

ALTER TABLE stock ADD COLUMN IF NOT EXISTS warehouse_uuid UUID REFERENCES warehouses(id);

-- Mapear por nombre de tienda (stock.warehouse_id suele ser el nombre de la tienda)
UPDATE stock sk
SET warehouse_uuid = w.id
FROM warehouses w
JOIN stores st ON w.store_id = st.id
WHERE UPPER(TRIM(sk.warehouse_id)) = UPPER(TRIM(st.code))
   OR UPPER(TRIM(sk.warehouse_id)) LIKE '%' || UPPER(TRIM(st.code)) || '%'
   OR UPPER(TRIM(sk.warehouse_id)) = UPPER(TRIM(w.name))
   OR UPPER(TRIM(st.name)) LIKE '%' || UPPER(TRIM(sk.warehouse_id)) || '%';

-- Fallback: almacén principal de MUJERES
UPDATE stock
SET warehouse_uuid = (
  SELECT w.id FROM warehouses w
  JOIN stores s ON w.store_id = s.id
  WHERE s.code = 'MUJERES'
  LIMIT 1
)
WHERE warehouse_uuid IS NULL;

-- ============================================================================
-- 6. MIGRAR movements.warehouse_id (TEXT → UUID)
-- ============================================================================

ALTER TABLE movements ADD COLUMN IF NOT EXISTS warehouse_id_old TEXT;
UPDATE movements SET warehouse_id_old = warehouse_id WHERE warehouse_id_old IS NULL;

ALTER TABLE movements ADD COLUMN IF NOT EXISTS warehouse_uuid UUID REFERENCES warehouses(id);

UPDATE movements mv
SET warehouse_uuid = w.id
FROM warehouses w
JOIN stores st ON w.store_id = st.id
WHERE UPPER(TRIM(mv.warehouse_id)) = UPPER(TRIM(st.code))
   OR UPPER(TRIM(mv.warehouse_id)) LIKE '%' || UPPER(TRIM(st.code)) || '%'
   OR UPPER(TRIM(mv.warehouse_id)) = UPPER(TRIM(w.name))
   OR UPPER(TRIM(st.name)) LIKE '%' || UPPER(TRIM(mv.warehouse_id)) || '%';

UPDATE movements
SET warehouse_uuid = (
  SELECT w.id FROM warehouses w
  JOIN stores s ON w.store_id = s.id
  WHERE s.code = 'MUJERES'
  LIMIT 1
)
WHERE warehouse_uuid IS NULL;

-- ============================================================================
-- 7. ÍNDICES en nuevas tablas
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_stores_code   ON stores(code);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_warehouses_store_id ON warehouses(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_store_uuid    ON sales(store_uuid);
CREATE INDEX IF NOT EXISTS idx_cashsh_store_uuid   ON cash_shifts(store_uuid);
CREATE INDEX IF NOT EXISTS idx_stock_wh_uuid       ON stock(warehouse_uuid);
CREATE INDEX IF NOT EXISTS idx_movements_wh_uuid   ON movements(warehouse_uuid);

-- ============================================================================
-- 8. QUERY DE VALIDACIÓN
-- ============================================================================
-- Ejecutar para verificar migraciones. No debería retornar filas con NULL:
--
-- SELECT 'sales sin store_uuid' as check, COUNT(*) FROM sales WHERE store_uuid IS NULL AND store_id IS NOT NULL
-- UNION ALL
-- SELECT 'cash_shifts sin store_uuid', COUNT(*) FROM cash_shifts WHERE store_uuid IS NULL AND store_id IS NOT NULL
-- UNION ALL
-- SELECT 'stock sin warehouse_uuid', COUNT(*) FROM stock WHERE warehouse_uuid IS NULL
-- UNION ALL
-- SELECT 'movements sin warehouse_uuid', COUNT(*) FROM movements WHERE warehouse_uuid IS NULL;

COMMENT ON TABLE stores IS 'Sedes/tiendas de la empresa (Mujeres, Hombres)';
COMMENT ON TABLE warehouses IS 'Almacenes por sede. Cada sede tiene al menos 1 almacén principal';
COMMENT ON COLUMN sales.store_uuid IS 'FK a stores(id). store_id_old mantiene el valor TEXT original para backup';
COMMENT ON COLUMN stock.warehouse_uuid IS 'FK a warehouses(id). warehouse_id_old mantiene el TEXT original';
