-- Migration: Supplier-Brands Many-to-Many Relationship
-- Description: Creates supplier_brands junction table for N:N relationship
-- Date: 2024-02-20
-- Reason: Suppliers can sell multiple brands, brands can be sold by multiple suppliers

-- ============================================================================
-- CREATE JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, brand_id)
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_supplier_brands_supplier ON supplier_brands(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_brands_brand ON supplier_brands(brand_id);
CREATE INDEX IF NOT EXISTS idx_supplier_brands_active ON supplier_brands(active);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE supplier_brands IS 'Junction table for many-to-many relationship between suppliers and brands';
COMMENT ON COLUMN supplier_brands.supplier_id IS 'Reference to supplier';
COMMENT ON COLUMN supplier_brands.brand_id IS 'Reference to brand';
COMMENT ON COLUMN supplier_brands.active IS 'Whether this supplier-brand relationship is active';

-- ============================================================================
-- EXAMPLE DATA (for testing)
-- ============================================================================

-- Note: Run this after you have suppliers and brands in your database
-- Example: If you have supplier "Proveedor A" and brands "Nike", "Adidas"
-- INSERT INTO supplier_brands (supplier_id, brand_id) VALUES
--   ((SELECT id FROM suppliers WHERE name = 'Proveedor A'), (SELECT id FROM brands WHERE name = 'Nike')),
--   ((SELECT id FROM suppliers WHERE name = 'Proveedor A'), (SELECT id FROM brands WHERE name = 'Adidas'));

