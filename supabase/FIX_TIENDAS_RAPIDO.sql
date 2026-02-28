-- ============================================================================
-- Script Rápido: Estandarizar Nombres de Tiendas
-- ============================================================================
-- Ejecuta este script en Supabase SQL Editor para corregir los nombres
-- ============================================================================

-- 1. Stock
UPDATE stock SET warehouse_id = 'Tienda Mujeres' 
WHERE warehouse_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'mujeres');

UPDATE stock SET warehouse_id = 'Tienda Hombres' 
WHERE warehouse_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'hombres');

-- 2. Movements
UPDATE movements SET warehouse_id = 'Tienda Mujeres' 
WHERE warehouse_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'mujeres');

UPDATE movements SET warehouse_id = 'Tienda Hombres' 
WHERE warehouse_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'hombres');

-- 3. Sales
UPDATE sales SET store_id = 'Tienda Mujeres' 
WHERE store_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'mujeres');

UPDATE sales SET store_id = 'Tienda Hombres' 
WHERE store_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'hombres');

-- 4. Cash Shifts
UPDATE cash_shifts SET store_id = 'Tienda Mujeres' 
WHERE store_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'mujeres');

UPDATE cash_shifts SET store_id = 'Tienda Hombres' 
WHERE store_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'hombres');

-- 5. Users
UPDATE users
SET stores = ARRAY(
  SELECT CASE 
    WHEN unnest IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'mujeres') THEN 'Tienda Mujeres'
    WHEN unnest IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'hombres') THEN 'Tienda Hombres'
    ELSE unnest
  END
  FROM unnest(stores)
);

-- 6. Verificar
SELECT 'Stock' as tabla, warehouse_id, COUNT(*) FROM stock GROUP BY warehouse_id
UNION ALL
SELECT 'Ventas', store_id, COUNT(*) FROM sales GROUP BY store_id
ORDER BY tabla, warehouse_id;

-- ✅ Listo! Deberías ver solo "Tienda Mujeres" y "Tienda Hombres"
