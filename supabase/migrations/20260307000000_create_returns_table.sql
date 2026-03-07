-- ============================================================================
-- MIGRATION: Create Returns (Devoluciones) Table
-- ============================================================================
-- Description: Sistema de devoluciones con período de 7 días + extensión de 7 días
-- Author: System
-- Date: 2026-03-07

-- ============================================================================
-- 1. CREATE RETURNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relación con venta original
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  sale_number VARCHAR(20) NOT NULL,
  
  -- Información del cliente
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name VARCHAR(255),
  
  -- Información de la tienda
  store_id VARCHAR(50) NOT NULL,
  
  -- Detalles de la devolución
  return_number VARCHAR(20) UNIQUE NOT NULL, -- DEV-0001, DEV-0002, etc.
  return_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Motivo de devolución
  reason TEXT NOT NULL,
  reason_type VARCHAR(50) NOT NULL CHECK (reason_type IN (
    'DEFECTO_PRODUCTO',      -- Producto defectuoso
    'TALLA_INCORRECTA',      -- Talla no adecuada
    'COLOR_DIFERENTE',       -- Color diferente al esperado
    'NO_SATISFECHO',         -- Cliente no satisfecho
    'CAMBIO_OPINION',        -- Cambió de opinión
    'OTRO'                   -- Otro motivo
  )),
  
  -- Tipo de devolución
  return_type VARCHAR(20) NOT NULL CHECK (return_type IN (
    'REEMBOLSO',  -- Devolución de dinero
    'CAMBIO'      -- Cambio por otro producto
  )),
  
  -- Montos
  total_amount DECIMAL(10, 2) NOT NULL, -- Monto total de la devolución
  refund_amount DECIMAL(10, 2) DEFAULT 0, -- Monto reembolsado (si aplica)
  
  -- Estado
  status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN (
    'PENDIENTE',   -- Devolución registrada, pendiente de procesar
    'APROBADA',    -- Devolución aprobada
    'RECHAZADA',   -- Devolución rechazada
    'COMPLETADA'   -- Devolución completada (reembolso o cambio realizado)
  )),
  
  -- Extensión de plazo
  extension_requested BOOLEAN DEFAULT FALSE,
  extension_granted BOOLEAN DEFAULT FALSE,
  extension_date TIMESTAMPTZ,
  extension_reason TEXT,
  
  -- Productos devueltos (JSON array)
  returned_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Formato: [{ product_id, product_name, quantity, unit_price, subtotal }]
  
  -- Productos de cambio (si aplica)
  exchange_items JSONB DEFAULT '[]'::jsonb,
  -- Formato: [{ product_id, product_name, quantity, unit_price, subtotal }]
  
  -- Notas y observaciones
  notes TEXT,
  admin_notes TEXT, -- Notas internas del administrador
  
  -- Auditoría
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_returns_sale_id ON returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_client_id ON returns(client_id);
CREATE INDEX IF NOT EXISTS idx_returns_store_id ON returns(store_id);
CREATE INDEX IF NOT EXISTS idx_returns_return_number ON returns(return_number);
CREATE INDEX IF NOT EXISTS idx_returns_return_date ON returns(return_date DESC);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON returns(created_at DESC);

-- ============================================================================
-- 3. CREATE FUNCTION FOR UPDATED_AT (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. CREATE TRIGGER FOR UPDATED_AT
-- ============================================================================

DROP TRIGGER IF EXISTS update_returns_updated_at ON returns;

CREATE TRIGGER update_returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. CREATE RLS POLICIES
-- ============================================================================

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view returns" ON returns;
DROP POLICY IF EXISTS "Authenticated users can create returns" ON returns;
DROP POLICY IF EXISTS "Authenticated users can update returns" ON returns;
DROP POLICY IF EXISTS "Only admins can delete returns" ON returns;

-- Policy: Usuarios autenticados pueden ver devoluciones
CREATE POLICY "Authenticated users can view returns"
  ON returns FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Usuarios autenticados pueden crear devoluciones
CREATE POLICY "Authenticated users can create returns"
  ON returns FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Usuarios autenticados pueden actualizar devoluciones
CREATE POLICY "Authenticated users can update returns"
  ON returns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Solo administradores pueden eliminar devoluciones
CREATE POLICY "Only admins can delete returns"
  ON returns FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- 6. CREATE FUNCTION TO GENERATE RETURN NUMBER
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS VARCHAR(20) AS $$
DECLARE
  next_number INTEGER;
  return_number VARCHAR(20);
BEGIN
  -- Obtener el siguiente número de devolución
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM returns
  WHERE return_number LIKE 'DEV-%';
  
  -- Formatear como DEV-0001, DEV-0002, etc.
  return_number := 'DEV-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN return_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. CREATE FUNCTION TO CHECK RETURN ELIGIBILITY
-- ============================================================================

CREATE OR REPLACE FUNCTION check_return_eligibility(
  p_sale_id UUID,
  OUT is_eligible BOOLEAN,
  OUT days_remaining INTEGER,
  OUT message TEXT
)
AS $$
DECLARE
  v_sale_date TIMESTAMPTZ;
  v_extension_granted BOOLEAN;
  v_extension_date TIMESTAMPTZ;
  v_days_since_sale INTEGER;
BEGIN
  -- Obtener fecha de venta
  SELECT created_at INTO v_sale_date
  FROM sales
  WHERE id = p_sale_id;
  
  IF v_sale_date IS NULL THEN
    is_eligible := FALSE;
    days_remaining := 0;
    message := 'Venta no encontrada';
    RETURN;
  END IF;
  
  -- Calcular días desde la venta
  v_days_since_sale := EXTRACT(DAY FROM NOW() - v_sale_date)::INTEGER;
  
  -- Verificar si hay extensión aprobada
  SELECT extension_granted, extension_date
  INTO v_extension_granted, v_extension_date
  FROM returns
  WHERE sale_id = p_sale_id
  AND extension_granted = TRUE
  LIMIT 1;
  
  -- Si hay extensión, el plazo es de 14 días desde la venta
  IF v_extension_granted THEN
    IF v_days_since_sale <= 14 THEN
      is_eligible := TRUE;
      days_remaining := 14 - v_days_since_sale;
      message := 'Elegible para devolución (extensión aprobada)';
    ELSE
      is_eligible := FALSE;
      days_remaining := 0;
      message := 'Plazo de devolución vencido (extensión expirada)';
    END IF;
  ELSE
    -- Sin extensión, el plazo es de 7 días
    IF v_days_since_sale <= 7 THEN
      is_eligible := TRUE;
      days_remaining := 7 - v_days_since_sale;
      message := 'Elegible para devolución';
    ELSE
      is_eligible := FALSE;
      days_remaining := 0;
      message := 'Plazo de devolución vencido (puede solicitar extensión)';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE returns IS 'Tabla de devoluciones con período de 7 días + extensión de 7 días';
COMMENT ON COLUMN returns.return_number IS 'Número único de devolución (DEV-0001, DEV-0002, etc.)';
COMMENT ON COLUMN returns.extension_requested IS 'Indica si el cliente solicitó extensión de plazo';
COMMENT ON COLUMN returns.extension_granted IS 'Indica si se aprobó la extensión de plazo';
COMMENT ON FUNCTION check_return_eligibility IS 'Verifica si una venta es elegible para devolución';
