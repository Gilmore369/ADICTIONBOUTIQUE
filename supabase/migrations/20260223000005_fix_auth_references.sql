-- ============================================================================
-- Migration: Fix referencias a auth.users → public.users
-- ============================================================================
-- Problema: clients.deactivated_by y analytics.report_executions.user_id
-- apuntan a auth.users directamente en lugar de public.users.
-- Fix: todo envuelto en DO $$ para chequear existencia antes de alterar.
-- ============================================================================

-- ============================================================================
-- 1. Corregir clients.deactivated_by → public.users
-- ============================================================================
DO $$
BEGIN
  -- Soltar FK viejo si existe (apuntaba a auth.users)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'clients'
      AND constraint_name = 'clients_deactivated_by_fkey'
  ) THEN
    ALTER TABLE clients DROP CONSTRAINT clients_deactivated_by_fkey;
  END IF;

  -- Solo crear si la columna deactivated_by existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'clients'
      AND column_name  = 'deactivated_by'
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_deactivated_by_fkey
      FOREIGN KEY (deactivated_by) REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 2. Corregir analytics.report_executions.user_id → public.users
--    (Solo si la tabla existe; se crea en 20240303000000_analytics_logging_and_indexes.sql)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'analytics'
      AND table_name   = 'report_executions'
  ) THEN
    -- Soltar FK viejo si existe
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema   = 'analytics'
        AND table_name     = 'report_executions'
        AND constraint_name = 'report_executions_user_id_fkey'
    ) THEN
      ALTER TABLE analytics.report_executions
        DROP CONSTRAINT report_executions_user_id_fkey;
    END IF;

    -- Crear FK apuntando a public.users
    ALTER TABLE analytics.report_executions
      ADD CONSTRAINT report_executions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id)
      ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'analytics.report_executions no existe aún — FK se creará cuando corra la migración de analytics.';
  END IF;
END $$;

-- ============================================================================
-- 3. Función: get_user_roles()
--    Lee roles desde JWT (sin recursión) con fallback a tabla (SECURITY DEFINER).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_roles TEXT[];
BEGIN
  -- Intentar leer desde JWT app_metadata (custom claim poblado en login hook)
  v_roles := COALESCE(
    (
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(
          COALESCE(
            auth.jwt() -> 'app_metadata' -> 'roles',
            auth.jwt() -> 'user_metadata' -> 'roles'
          )
        )
      )
      WHERE auth.jwt() IS NOT NULL
        AND (auth.jwt() -> 'app_metadata' -> 'roles') IS NOT NULL
    ),
    ARRAY[]::TEXT[]
  );

  -- Fallback: query directa a tabla (segura porque somos SECURITY DEFINER)
  IF array_length(v_roles, 1) IS NULL THEN
    SELECT roles INTO v_roles
    FROM public.users
    WHERE id = auth.uid();
  END IF;

  RETURN COALESCE(v_roles, ARRAY[]::TEXT[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles TO anon;

COMMENT ON FUNCTION public.get_user_roles IS
  'Lee roles desde JWT custom claims (sin recursión) con fallback a tabla. SECURITY DEFINER.';

-- ============================================================================
-- 4. Función auxiliar: is_admin()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN 'admin' = ANY(public.get_user_roles());
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;

COMMENT ON FUNCTION public.is_admin IS
  'True si el usuario autenticado tiene rol admin.';

-- ============================================================================
-- 5. Función auxiliar: has_role(role)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN p_role = ANY(public.get_user_roles());
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;

COMMENT ON FUNCTION public.has_role IS
  'True si el usuario autenticado tiene el rol dado. Usar en policies RLS sin recursión.';
