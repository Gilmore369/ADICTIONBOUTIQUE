-- ============================================================================
-- ACTUALIZACIÓN DE EMAILS DE CLIENTES PARA PRUEBAS
-- ============================================================================
-- Asigna emails de prueba al 50% de los clientes:
--   - Mitad impar  → gianpepex@gmail.com
--   - Mitad par    → karianaghostimporter@gmail.com
--
-- Solo actualiza clientes que NO tienen email ya asignado.
-- Ejecutar en Supabase Dashboard → SQL Editor.
-- ============================================================================

-- Ver cuántos clientes hay sin email (antes de ejecutar)
-- SELECT COUNT(*) FROM clients WHERE (email IS NULL OR email = '');

-- Asignar emails: usa el row_number para dividir 50/50
WITH numbered AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM clients
  WHERE (email IS NULL OR email = '')
    AND active = true
)
UPDATE clients
SET email = CASE
  WHEN n.rn % 2 = 1 THEN 'gianpepex@gmail.com'
  ELSE 'karianaghostimporter@gmail.com'
END
FROM numbered n
WHERE clients.id = n.id;

-- Verificar resultado
SELECT
  email,
  COUNT(*) AS total
FROM clients
WHERE email IN ('gianpepex@gmail.com', 'karianaghostimporter@gmail.com')
GROUP BY email
ORDER BY email;
