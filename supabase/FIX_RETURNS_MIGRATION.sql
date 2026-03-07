-- ============================================================================
-- FIX RETURNS MIGRATION - Ejecutar este script en lugar de la migración
-- ============================================================================
-- Este script corrige el problema de objetos duplicados
-- ============================================================================

-- PASO 1: Limpiar objetos existentes (si existen)
-- ============================================================================

-- Drop policies si existen
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view returns" ON returns;
  DROP POLICY IF EXISTS "Authenticated users can create returns" ON returns;
  DROP POLICY IF EXISTS "Authenticated users can update returns" ON returns;
  DROP POLICY IF EXISTS "Only admins can delete returns" ON returns;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Drop trigger si existe
DROP TRIGGER IF EXISTS update_returns_updated_at ON returns;

-- Drop indexes si existen
DROP INDEX IF EXISTS idx_returns_sale_id;
DROP INDEX IF EXISTS idx_returns_client_id;
DROP INDEX IF EXISTS idx_returns_store_id;
DROP INDEX IF EXISTS idx_returns_return_number;
DROP INDEX IF EXISTS idx_returns_return_date;
DROP INDEX IF EXISTS idx_returns_status;
DROP INDEX IF EXISTS idx_returns_created_at;

-- Drop functions si existen
DROP FUNCTION IF EXISTS generate_return_number();
DROP FUNCTION IF EXISTS check_return_eligibility(UUID);

-- PASO 2: Crear tabla si no existe
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
  return_number VARCHAR(20) UNIQUE NOT NULL,
  return_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Motivo de devolución
  reason TEXT NOT NULL,
  reason_type VARCHAR(50) NOT NULL CHECK (reason_type IN (
    'DEFECTO_PRODUCTO',
    'TALLA_INCORRECTA',
    'COLOR_DIFERENTE',
    'NO_SATISFECHO',
    'CAMBIO_OPINION',
    'OTRO'
  )),
  
  -- Tipo de devolución
  return_type VARCHAR(20) NOT NULL CHECK (return_type IN (
    'REEMBOLSO',
    'CAMBIO'
  )),
  
  -- Montos
  total_amount DECIMAL(10, 2) NOT NULL,
  refund_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- Estado
  status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN (
    'PENDIENTE',
    'APROBADA',
    'RECHAZADA',
    'COMPLETADA'
  )),
  
  -- Extensión de plazo
  extension_requested BOOLEAN DEFAULT FALSE,
  extension_granted BOOLEAN DEFAULT FALSE,
  extension_date TIMESTAMPTZ,
  extension_reason TEXT,
  
  -- Productos devueltos (JSON array)
  returned_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Productos de cambio (si aplica)
  exchange_items JSONB DEFAULT '[]'::jsonb,
  
  -- Notas y observaciones
  notes TEXT,
  admin_notes TEXT,
  
  -- Auditoría
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PASO 3: Crear índices
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_returns_sale_id ON returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_client_id ON returns(client_id);
CREATE INDEX IF NOT EXISTS idx_returns_store_id ON returns(store_id);
CREATE INDEX IF NOT EXISTS idx_returns_return_number ON returns(return_number);
CREATE INDEX IF NOT EXISTS idx_returns_return_date ON returns(return_date DESC);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON returns(created_at DESC);

-- PASO 4: Crear función update_updated_at si no existe
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PASO 5: Crear trigger
-- ============================================================================

DROP TRIGGER IF EXISTS update_returns_updated_at ON returns;

CREATE TRIGGER update_returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- PASO 6: Habilitar RLS y crear políticas
-- ============================================================================

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view returns" ON returns;
DROP POLICY IF EXISTS "Authenticated users can create returns" ON returns;
DROP POLICY IF EXISTS "Authenticated users can update returns" ON returns;
DROP POLICY IF EXISTS "Only admins can delete returns" ON returns;

-- Create policies
CREATE POLICY "Authenticated users can view returns"
  ON returns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create returns"
  ON returns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update returns"
  ON returns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

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

-- PASO 7: Crear función para generar números de devolución
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS VARCHAR(20) AS $$
DECLARE
  next_number INTEGER;
  return_number VARCHAR(20);
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM returns
  WHERE return_number LIKE 'DEV-%';
  
  return_number := 'DEV-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN return_number;
END;
$$ LANGUAGE plpgsql;

-- PASO 8: Crear función para verificar elegibilidad
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
  SELECT created_at INTO v_sale_date
  FROM sales
  WHERE id = p_sale_id;
  
  IF v_sale_date IS NULL THEN
    is_eligible := FALSE;
    days_remaining := 0;
    message := 'Venta no encontrada';
    RETURN;
  END IF;
  
  v_days_since_sale := EXTRACT(DAY FROM NOW() - v_sale_date)::INTEGER;
  
  SELECT extension_granted, extension_date
  INTO v_extension_granted, v_extension_date
  FROM returns
  WHERE sale_id = p_sale_id
  AND extension_granted = TRUE
  LIMIT 1;
  
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

-- PASO 9: Agregar comentarios
-- ============================================================================

COMMENT ON TABLE returns IS 'Tabla de devoluciones con período de 7 días + extensión de 7 días';
COMMENT ON COLUMN returns.return_number IS 'Número único de devolución (DEV-0001, DEV-0002, etc.)';
COMMENT ON COLUMN returns.extension_requested IS 'Indica si el cliente solicitó extensión de plazo';
COMMENT ON COLUMN returns.extension_granted IS 'Indica si se aprobó la extensión de plazo';
COMMENT ON FUNCTION check_return_eligibility IS 'Verifica si una venta es elegible para devolución';

-- ============================================================================
-- RESULTADO
-- ============================================================================

SELECT 'Migración de returns completada exitosamente' AS resultado;
