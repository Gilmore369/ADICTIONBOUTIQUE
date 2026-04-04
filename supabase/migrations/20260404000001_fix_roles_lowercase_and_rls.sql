-- ============================================================================
-- FIX: Normalizar roles a minúsculas + hacer get_user_roles case-insensitive
-- PROBLEMA: has_role('admin') falla si el usuario tiene 'ADMIN' en la BD
-- SOLUCIÓN: 1) normalizar roles existentes, 2) get_user_roles devuelve lowercase
-- ============================================================================

-- 1. Normalizar todos los roles a minúsculas en la tabla users
UPDATE users
SET roles = (
  SELECT array_agg(lower(r))
  FROM unnest(roles) AS r
)
WHERE roles IS NOT NULL
  AND roles != (
    SELECT array_agg(lower(r))
    FROM unnest(roles) AS r
  );

-- 2. Actualizar get_user_roles para que SIEMPRE devuelva lowercase
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
        SELECT lower(jsonb_array_elements_text(
          COALESCE(
            auth.jwt() -> 'app_metadata' -> 'roles',
            auth.jwt() -> 'user_metadata' -> 'roles'
          )
        ))
      )
      WHERE auth.jwt() IS NOT NULL
        AND (auth.jwt() -> 'app_metadata' -> 'roles') IS NOT NULL
    ),
    ARRAY[]::TEXT[]
  );

  -- Fallback: query directa a tabla (SECURITY DEFINER bypasses RLS)
  IF array_length(v_roles, 1) IS NULL THEN
    SELECT array_agg(lower(r))
    INTO v_roles
    FROM users, unnest(roles) AS r
    WHERE id = auth.uid();
  END IF;

  RETURN COALESCE(v_roles, ARRAY[]::TEXT[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles TO anon;

-- 3. Actualizar has_role para comparación case-insensitive (doble seguridad)
CREATE OR REPLACE FUNCTION public.has_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN lower(p_role) = ANY(public.get_user_roles());
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;

-- 4. Verificar resultado
SELECT id, email, roles FROM users ORDER BY email;
