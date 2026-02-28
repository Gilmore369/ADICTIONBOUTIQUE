-- ============================================================================
-- SCRIPT COMPLETO: Aplicar Relación Supplier-Brands
-- ============================================================================
-- Descripción: Ejecuta todos los pasos necesarios para implementar
--              la relación muchos-a-muchos entre proveedores y marcas
-- Fecha: 2024-02-20
-- Instrucciones: Copiar y pegar TODO este archivo en Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PASO 1: Crear tabla supplier_brands
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, brand_id)
);

-- ============================================================================
-- PASO 2: Crear índices para performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_supplier_brands_supplier ON supplier_brands(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_brands_brand ON supplier_brands(brand_id);

-- ============================================================================
-- PASO 3: Deshabilitar RLS (consistente con otras tablas)
-- ============================================================================

ALTER TABLE supplier_brands DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 4: Poblar relaciones (TODOS los proveedores con TODAS las marcas)
-- ============================================================================
-- Nota: Esto es temporal para que funcione inmediatamente
-- Después puedes ajustar las relaciones específicas

INSERT INTO supplier_brands (supplier_id, brand_id)
SELECT 
  s.id as supplier_id,
  b.id as brand_id
FROM suppliers s
CROSS JOIN brands b
WHERE s.active = true AND b.active = true
ON CONFLICT (supplier_id, brand_id) DO NOTHING;

-- ============================================================================
-- PASO 5: Verificar que se crearon las relaciones
-- ============================================================================

SELECT 
  'Relaciones creadas' as status,
  COUNT(*) as total_relaciones,
  COUNT(DISTINCT supplier_id) as proveedores,
  COUNT(DISTINCT brand_id) as marcas
FROM supplier_brands;

-- ============================================================================
-- PASO 6: Ver detalle de relaciones
-- ============================================================================

SELECT 
  s.name as proveedor,
  STRING_AGG(b.name, ', ' ORDER BY b.name) as marcas
FROM supplier_brands sb
JOIN suppliers s ON sb.supplier_id = s.id
JOIN brands b ON sb.brand_id = b.id
GROUP BY s.id, s.name
ORDER BY s.name;

-- ============================================================================
-- RESULTADO ESPERADO
-- ============================================================================
-- Deberías ver:
-- 1. Tabla supplier_brands creada
-- 2. Índices creados
-- 3. N relaciones creadas (N = proveedores × marcas)
-- 4. Lista de proveedores con sus marcas
--
-- Ejemplo:
-- proveedor          | marcas
-- -------------------|---------------------------
-- Importadora Global | H&M, Nike, Zara
-- Distribuidora XYZ  | Adidas, Puma, Reebok
-- ============================================================================

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE supplier_brands IS 'Junction table for many-to-many relationship between suppliers and brands - allows multibrand suppliers';
COMMENT ON COLUMN supplier_brands.supplier_id IS 'Reference to supplier';
COMMENT ON COLUMN supplier_brands.brand_id IS 'Reference to brand that this supplier sells';

-- ============================================================================
-- ✅ MIGRACIÓN COMPLETADA
-- ============================================================================
-- Siguiente paso: Reiniciar servidor Next.js
-- cd supa && npm run dev
-- ============================================================================
