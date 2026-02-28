-- ============================================================================
-- ASIGNAR ROL DE ADMINISTRADOR
-- ============================================================================
-- Este script asigna el rol de 'admin' al usuario gianpepex@gmail.com
-- y le da acceso a ambas tiendas (TIENDA_HOMBRES y TIENDA_MUJERES)
-- ============================================================================

-- Buscar el usuario por email y asignar rol admin
UPDATE users
SET 
  roles = ARRAY['admin']::text[],
  stores = ARRAY['TIENDA_HOMBRES', 'TIENDA_MUJERES']::text[],
  updated_at = NOW()
WHERE email = 'gianpepex@gmail.com';

-- Verificar que se actualizó correctamente
SELECT 
  id,
  email,
  name,
  roles,
  stores,
  active,
  created_at
FROM users
WHERE email = 'gianpepex@gmail.com';

-- Si el usuario no existe en la tabla users, necesitamos crearlo
-- (esto puede pasar si solo existe en auth.users pero no en public.users)

DO $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT := 'gianpepex@gmail.com';
  v_user_count INTEGER;
BEGIN
  -- Verificar si el usuario existe en la tabla users
  SELECT COUNT(*) INTO v_user_count
  FROM users
  WHERE email = v_user_email;
  
  IF v_user_count = 0 THEN
    RAISE NOTICE 'Usuario no encontrado en tabla users, buscando en auth.users...';
    
    -- Buscar el ID del usuario en auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_user_email;
    
    IF v_user_id IS NOT NULL THEN
      RAISE NOTICE 'Usuario encontrado en auth.users con ID: %', v_user_id;
      
      -- Insertar el usuario en la tabla public.users
      INSERT INTO users (
        id,
        email,
        name,
        roles,
        stores,
        active
      ) VALUES (
        v_user_id,
        v_user_email,
        'Admin User',
        ARRAY['admin']::text[],
        ARRAY['TIENDA_HOMBRES', 'TIENDA_MUJERES']::text[],
        true
      );
      
      RAISE NOTICE 'Usuario creado en tabla users con rol admin';
    ELSE
      RAISE NOTICE 'Usuario no encontrado en auth.users. Debe registrarse primero.';
    END IF;
  ELSE
    RAISE NOTICE 'Usuario actualizado correctamente con rol admin';
  END IF;
END $$;

-- Verificación final
SELECT 
  'Usuario configurado correctamente' AS mensaje,
  email,
  name,
  roles,
  stores,
  active
FROM users
WHERE email = 'gianpepex@gmail.com';
