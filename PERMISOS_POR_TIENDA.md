# Sistema de Permisos por Tienda

## 🏪 Configuración Actual

Tu empresa tiene 2 tiendas físicas:
- **TIENDA_HOMBRES** - Tienda de Hombres
- **TIENDA_MUJERES** - Tienda de Mujeres

Cada tienda tiene su propia caja independiente.

## 👥 Roles y Permisos

### Usuario Actual (Admin General)
- ✅ Puede ver y gestionar ambas tiendas
- ✅ Puede abrir/cerrar caja en cualquier tienda
- ✅ Puede ver reportes consolidados de ambas tiendas
- ✅ Puede asignar usuarios a tiendas específicas

### Futuros Usuarios por Tienda

#### Cajero Tienda Hombres
```sql
-- Crear usuario cajero para tienda de hombres
INSERT INTO users (email, roles, stores) VALUES
('cajero.hombres@empresa.com', ARRAY['cajero'], ARRAY['TIENDA_HOMBRES']);
```
- ✅ Solo puede abrir/cerrar caja en Tienda Hombres
- ✅ Solo ve turnos de su tienda
- ✅ Solo registra gastos de su tienda
- ❌ No puede acceder a Tienda Mujeres

#### Cajero Tienda Mujeres
```sql
-- Crear usuario cajero para tienda de mujeres
INSERT INTO users (email, roles, stores) VALUES
('cajero.mujeres@empresa.com', ARRAY['cajero'], ARRAY['TIENDA_MUJERES']);
```
- ✅ Solo puede abrir/cerrar caja en Tienda Mujeres
- ✅ Solo ve turnos de su tienda
- ✅ Solo registra gastos de su tienda
- ❌ No puede acceder a Tienda Hombres

## 🔧 Implementación Futura

### 1. Agregar columna `stores` a la tabla users

```sql
-- Migración para agregar columna stores
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stores TEXT[] DEFAULT ARRAY['TIENDA_HOMBRES', 'TIENDA_MUJERES'];

-- Actualizar usuario admin para que tenga acceso a ambas tiendas
UPDATE users 
SET stores = ARRAY['TIENDA_HOMBRES', 'TIENDA_MUJERES']
WHERE 'admin' = ANY(roles);
```

### 2. Modificar el componente de Caja

Actualizar `components/cash/cash-shift-manager.tsx` para filtrar tiendas según el usuario:

```typescript
// En lugar de mostrar todas las tiendas
const STORES = [
  { id: 'TIENDA_HOMBRES', name: 'Tienda Hombres' },
  { id: 'TIENDA_MUJERES', name: 'Tienda Mujeres' }
]

// Filtrar según las tiendas asignadas al usuario
const userStores = user.stores || ['TIENDA_HOMBRES', 'TIENDA_MUJERES']
const availableStores = STORES.filter(store => userStores.includes(store.id))
```

### 3. Actualizar las políticas RLS (Row Level Security)

```sql
-- Política para que los cajeros solo vean turnos de sus tiendas
CREATE POLICY "cajeros_own_store_shifts" ON cash_shifts
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM users 
      WHERE store_id = ANY(stores)
    )
  );

-- Política para que solo puedan abrir turnos en sus tiendas
CREATE POLICY "cajeros_create_own_store_shifts" ON cash_shifts
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT unnest(stores) FROM users WHERE id = auth.uid()
    )
  );
```

## 📊 Reportes por Tienda

### Ventas por Tienda
```sql
-- Ver ventas de Tienda Hombres
SELECT 
  DATE(created_at) as fecha,
  COUNT(*) as num_ventas,
  SUM(total_amount) as total
FROM sales s
JOIN cash_shifts cs ON DATE(s.created_at) = DATE(cs.opened_at)
WHERE cs.store_id = 'TIENDA_HOMBRES'
GROUP BY DATE(created_at)
ORDER BY fecha DESC;
```

### Comparación entre Tiendas
```sql
-- Comparar rendimiento de ambas tiendas
SELECT 
  cs.store_id as tienda,
  COUNT(DISTINCT cs.id) as turnos,
  SUM(cs.closing_amount - cs.opening_amount) as ganancia_neta,
  AVG(cs.closing_amount - cs.opening_amount) as promedio_por_turno
FROM cash_shifts cs
WHERE cs.status = 'CLOSED'
  AND cs.closed_at >= NOW() - INTERVAL '30 days'
GROUP BY cs.store_id;
```

## 🎯 Flujo de Trabajo Recomendado

### Apertura Diaria
1. **8:00 AM - Tienda Hombres**
   - Cajero de hombres inicia sesión
   - Abre turno con monto inicial
   - Solo ve opción "Tienda Hombres"

2. **8:00 AM - Tienda Mujeres**
   - Cajero de mujeres inicia sesión
   - Abre turno con monto inicial
   - Solo ve opción "Tienda Mujeres"

### Durante el Día
- Cada cajero registra sus propios gastos
- Las ventas se asocian automáticamente a la tienda
- Los reportes se generan por tienda

### Cierre Diario
1. **8:00 PM - Ambas Tiendas**
   - Cada cajero cuenta su caja
   - Cierra su turno
   - El sistema calcula diferencias

### Revisión del Admin
- El admin puede ver ambos turnos
- Compara rendimiento entre tiendas
- Identifica patrones y oportunidades

## 🔐 Seguridad

### Separación de Datos
- Cada cajero solo ve datos de su tienda
- No pueden modificar turnos de otras tiendas
- Los reportes se filtran automáticamente

### Auditoría
- Todos los cambios quedan registrados
- Se puede rastrear quién hizo qué en cada tienda
- El admin tiene visibilidad completa

## 📝 Próximos Pasos

1. ✅ Configurar nombres de tiendas (COMPLETADO)
2. ⏳ Agregar columna `stores` a tabla users
3. ⏳ Crear usuarios específicos por tienda
4. ⏳ Implementar filtrado por tienda en el componente
5. ⏳ Actualizar políticas RLS
6. ⏳ Crear reportes comparativos entre tiendas

## 💡 Ejemplo de Uso

```typescript
// Usuario Admin
{
  email: "admin@empresa.com",
  roles: ["admin"],
  stores: ["TIENDA_HOMBRES", "TIENDA_MUJERES"]
}

// Cajero Tienda Hombres
{
  email: "cajero.hombres@empresa.com",
  roles: ["cajero"],
  stores: ["TIENDA_HOMBRES"]
}

// Cajero Tienda Mujeres
{
  email: "cajero.mujeres@empresa.com",
  roles: ["cajero"],
  stores: ["TIENDA_MUJERES"]
}
```

## 🎨 Personalización

Si necesitas cambiar los nombres de las tiendas en el futuro:

1. Actualiza `components/cash/cash-shift-manager.tsx`
2. Actualiza los datos existentes en la base de datos:
   ```sql
   UPDATE cash_shifts 
   SET store_id = 'NUEVO_NOMBRE' 
   WHERE store_id = 'NOMBRE_ANTIGUO';
   ```
