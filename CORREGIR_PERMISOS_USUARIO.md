# Corregir Permisos de Usuario

## Problema

Al intentar filtrar clientes en la lista, aparece el error:

```
No tiene permisos para realizar esta acción
```

## Causa

El usuario `gianpepex@gmail.com` no tiene roles asignados en la tabla `users`. 

El sistema requiere que los usuarios tengan al menos uno de estos roles:
- `admin` - Acceso completo al sistema
- `vendedor` - Puede gestionar ventas y clientes
- `cajero` - Puede gestionar caja y ventas
- `cobrador` - Puede gestionar cobranzas

## Solución

Ejecutar el script SQL que asigna el rol de `admin` a tu usuario.

### Pasos:

1. Abre [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor**
3. Copia y pega el contenido de: `supabase/ASIGNAR_ROL_ADMIN.sql`
4. Haz clic en **Run**
5. Cierra sesión en tu aplicación
6. Vuelve a iniciar sesión
7. Intenta filtrar clientes nuevamente

## Qué Hace el Script

El script:

1. **Busca** tu usuario por email (`gianpepex@gmail.com`)
2. **Asigna** el rol de `admin`
3. **Asigna** acceso a ambas tiendas (`TIENDA_HOMBRES` y `TIENDA_MUJERES`)
4. **Verifica** que la actualización fue exitosa

Si el usuario no existe en la tabla `users` (solo en `auth.users`), el script lo crea automáticamente.

## Verificación

Después de ejecutar el script, deberías ver algo como:

```
mensaje: "Usuario configurado correctamente"
email: "gianpepex@gmail.com"
name: "Admin User"
roles: ["admin"]
stores: ["TIENDA_HOMBRES", "TIENDA_MUJERES"]
active: true
```

## Permisos del Rol Admin

Con el rol `admin`, puedes:

- ✅ Ver y gestionar todos los clientes
- ✅ Crear, editar y eliminar productos
- ✅ Realizar ventas (contado y crédito)
- ✅ Gestionar caja (abrir/cerrar turnos)
- ✅ Ver y gestionar cobranzas
- ✅ Acceder a reportes y estadísticas
- ✅ Gestionar usuarios (crear, editar, asignar roles)
- ✅ Acceder a ambas tiendas simultáneamente
- ✅ Anular ventas
- ✅ Ver logs de auditoría

## Otros Roles

Si necesitas crear usuarios con otros roles:

### Vendedor
```sql
UPDATE users
SET roles = ARRAY['vendedor']::text[],
    stores = ARRAY['TIENDA_HOMBRES']::text[]
WHERE email = 'vendedor@example.com';
```

### Cajero
```sql
UPDATE users
SET roles = ARRAY['cajero']::text[],
    stores = ARRAY['TIENDA_MUJERES']::text[]
WHERE email = 'cajero@example.com';
```

### Cobrador
```sql
UPDATE users
SET roles = ARRAY['cobrador']::text[]
WHERE email = 'cobrador@example.com';
```

### Múltiples Roles
```sql
UPDATE users
SET roles = ARRAY['vendedor', 'cajero']::text[],
    stores = ARRAY['TIENDA_HOMBRES', 'TIENDA_MUJERES']::text[]
WHERE email = 'usuario@example.com';
```

## Notas Importantes

- ⚠️ Debes **cerrar sesión y volver a iniciar** después de cambiar roles
- ⚠️ Los cambios de roles no se aplican a sesiones activas
- ⚠️ El campo `stores` define a qué tiendas tiene acceso el usuario
- ⚠️ Los usuarios sin roles no pueden acceder a ninguna funcionalidad
- ⚠️ Solo los usuarios con rol `admin` pueden gestionar otros usuarios

## Troubleshooting

### El error persiste después de ejecutar el script

1. Verifica que el script se ejecutó sin errores
2. Cierra sesión completamente (no solo refrescar)
3. Limpia el caché del navegador (Ctrl+Shift+Delete)
4. Vuelve a iniciar sesión
5. Verifica en Supabase Dashboard > Authentication > Users que tu usuario existe
6. Verifica en Supabase Dashboard > Table Editor > users que tu usuario tiene roles asignados

### El usuario no aparece en la tabla users

Esto significa que el usuario solo existe en `auth.users` pero no en `public.users`. El script debería crear el registro automáticamente, pero si no funciona:

```sql
-- Obtener el ID del usuario de auth.users
SELECT id, email FROM auth.users WHERE email = 'gianpepex@gmail.com';

-- Insertar manualmente en users (reemplaza USER_ID_AQUI con el ID obtenido)
INSERT INTO users (id, email, name, roles, stores, active)
VALUES (
  'USER_ID_AQUI',
  'gianpepex@gmail.com',
  'Admin User',
  ARRAY['admin']::text[],
  ARRAY['TIENDA_HOMBRES', 'TIENDA_MUJERES']::text[],
  true
);
```
