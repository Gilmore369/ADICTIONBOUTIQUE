-- ============================================================================
-- FIX: Normalizar roles a minúsculas en tabla users
-- ============================================================================
-- Problema: algunos usuarios tienen roles en mayúsculas (ADMIN, VENDEDOR)
-- y otros en minúsculas (admin, vendedor).
-- El código ahora hace .toLowerCase() pero la BD también debe ser consistente.
-- ============================================================================

-- Ver estado actual
SELECT
  id,
  email,
  roles,
  array_agg(lower(r)) AS roles_normalized
FROM users,
  unnest(roles) AS r
GROUP BY id, email, roles
ORDER BY email;

-- Normalizar TODOS los roles a minúsculas
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

-- Verificar resultado
SELECT id, email, roles
FROM users
ORDER BY email;
