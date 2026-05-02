-- =====================================================
-- Añadir columna RUC a suppliers
-- Fecha: 2026-05-01
-- =====================================================
--
-- En Perú el RUC es el identificador tributario obligatorio para
-- cualquier proveedor. Era un campo faltante crítico.
-- Notes ya existe en la BD pero el código lo excluía por una migración antigua;
-- lo dejamos disponible para que el server action lo use.
-- =====================================================

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS ruc TEXT;

-- Index para búsquedas por RUC (no UNIQUE: puede haber proveedores informales sin RUC)
CREATE INDEX IF NOT EXISTS idx_suppliers_ruc ON public.suppliers(ruc) WHERE ruc IS NOT NULL;

COMMENT ON COLUMN public.suppliers.ruc IS 'RUC del proveedor (11 dígitos). Opcional para proveedores informales.';
