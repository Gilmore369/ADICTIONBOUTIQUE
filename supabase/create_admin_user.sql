-- Script para crear usuario administrador de prueba
-- Ejecutar DESPUÉS de crear el usuario en Supabase Auth Dashboard

-- PASO 1: Crear usuario en Supabase Dashboard → Authentication → Add User
-- Email: gianpepex@gmail.com
-- Password: (tu contraseña)
-- UUID copiado: 804419ec-cda6-4a6e-9388-c44f0058e635

-- PASO 2: Ejecutar este script

-- Insertar usuario en tabla users con rol admin
INSERT INTO users (
  id,
  email,
  name,
  roles,
  stores,
  active
) VALUES (
  '804419ec-cda6-4a6e-9388-c44f0058e635'::uuid,
  'gianpepex@gmail.com',
  'Admin User',
  ARRAY['admin'],
  ARRAY['TIENDA_MUJERES', 'TIENDA_HOMBRES'],
  true
)
ON CONFLICT (id) DO UPDATE SET
  roles = ARRAY['admin'],
  stores = ARRAY['TIENDA_MUJERES', 'TIENDA_HOMBRES'],
  active = true;

-- Verificar que se creó correctamente
SELECT id, email, name, roles, stores, active
FROM users
WHERE email = 'gianpepex@gmail.com';
