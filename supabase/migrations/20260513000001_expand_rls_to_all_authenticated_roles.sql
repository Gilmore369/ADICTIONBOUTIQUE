-- ─────────────────────────────────────────────────────────────────────────
-- Migración: ampliar políticas RLS a todos los roles autenticados
-- Fecha: 2026-05-13
-- ─────────────────────────────────────────────────────────────────────────
-- Decisión de negocio: vendedor, cajero y cobrador deben poder ejecutar
-- TODAS las operaciones del flujo de tienda (catálogos, productos, clientes,
-- ventas, pagos, caja, devoluciones, etc.).
--
-- Solo siguen siendo admin-only:
--   - users (gestión de usuarios)
--   - audit_log (lectura de logs)
--   - settings (configuración del negocio)
--
-- Esta migración reemplaza las políticas anteriores que solo permitían
-- 'admin' OR 'vendedor'.
--
-- Es idempotente: DROP IF EXISTS antes de CREATE.
-- ─────────────────────────────────────────────────────────────────────────

-- Función auxiliar: verifica si el usuario actual tiene cualquier rol válido
CREATE OR REPLACE FUNCTION public.has_operational_role()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND (
        'admin'    = ANY(roles) OR
        'vendedor' = ANY(roles) OR
        'cajero'   = ANY(roles) OR
        'cobrador' = ANY(roles)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_operational_role() TO authenticated;

-- ── Catálogos: lines, categories, brands, sizes, suppliers ──────────────
DROP POLICY IF EXISTS "lines_manage" ON lines;
CREATE POLICY "lines_manage" ON lines
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

DROP POLICY IF EXISTS "categories_manage" ON categories;
CREATE POLICY "categories_manage" ON categories
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

DROP POLICY IF EXISTS "brands_manage" ON brands;
CREATE POLICY "brands_manage" ON brands
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

DROP POLICY IF EXISTS "sizes_manage" ON sizes;
CREATE POLICY "sizes_manage" ON sizes
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

DROP POLICY IF EXISTS "suppliers_manage" ON suppliers;
CREATE POLICY "suppliers_manage" ON suppliers
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

-- ── Productos + inventario ─────────────────────────────────────────────
DROP POLICY IF EXISTS "products_manage" ON products;
CREATE POLICY "products_manage" ON products
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

DROP POLICY IF EXISTS "stock_manage" ON stock;
CREATE POLICY "stock_manage" ON stock
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

DROP POLICY IF EXISTS "movements_manage" ON movements;
CREATE POLICY "movements_manage" ON movements
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

-- ── Clientes ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clients_manage" ON clients;
CREATE POLICY "clients_manage" ON clients
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

-- ── Ventas (incluye anulación) ─────────────────────────────────────────
DROP POLICY IF EXISTS "sales_manage" ON sales;
CREATE POLICY "sales_manage" ON sales
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

DROP POLICY IF EXISTS "sale_items_manage" ON sale_items;
CREATE POLICY "sale_items_manage" ON sale_items
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

-- ── Créditos y pagos ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "credit_plans_manage" ON credit_plans;
CREATE POLICY "credit_plans_manage" ON credit_plans
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

DROP POLICY IF EXISTS "installments_manage" ON installments;
CREATE POLICY "installments_manage" ON installments
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

DROP POLICY IF EXISTS "payments_manage" ON payments;
CREATE POLICY "payments_manage" ON payments
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

-- ── Caja ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cash_shifts_manage" ON cash_shifts;
CREATE POLICY "cash_shifts_manage" ON cash_shifts
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

DROP POLICY IF EXISTS "cash_expenses_manage" ON cash_expenses;
CREATE POLICY "cash_expenses_manage" ON cash_expenses
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

-- ── Devoluciones ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "returns_manage" ON returns;
CREATE POLICY "returns_manage" ON returns
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

-- ── Acciones de cobranza + visitas ─────────────────────────────────────
DROP POLICY IF EXISTS "collection_actions_manage" ON collection_actions;
CREATE POLICY "collection_actions_manage" ON collection_actions
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

DROP POLICY IF EXISTS "client_visits_manage" ON client_visits;
CREATE POLICY "client_visits_manage" ON client_visits
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

-- ── Importación legacy (cualquier rol válido puede importar) ───────────
DROP POLICY IF EXISTS "legacy_import_batches_manage" ON legacy_import_batches;
CREATE POLICY "legacy_import_batches_manage" ON legacy_import_batches
  FOR ALL TO authenticated
  USING (public.has_operational_role())
  WITH CHECK (public.has_operational_role());

-- ── Tablas que se MANTIENEN admin-only ─────────────────────────────────
-- (estas NO se tocan, mantienen sus políticas originales):
--   - users         → solo admin puede crear/editar/borrar
--   - audit_log     → solo admin puede leer
--   - settings/cfg  → solo admin puede modificar
-- ─────────────────────────────────────────────────────────────────────────
