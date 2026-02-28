# Solución: Apertura de Caja para Múltiples Tiendas

## Problema
Como usuario administrador, no puedes abrir turnos de caja para ambas tiendas (TIENDA_HOMBRES y TIENDA_MUJERES) simultáneamente. Recibes el error: "Ya hay un turno abierto para esta tienda".

## Causa
Puede haber una de estas causas:

1. **Ya existe un turno abierto** para la tienda que intentas abrir
2. **Restricción en la base de datos** que no permite múltiples turnos abiertos por tienda
3. **Caché del navegador** mostrando un error antiguo

## Solución

### Paso 1: Verificar y Limpiar Turnos Abiertos

Ejecuta este script en Supabase SQL Editor:

```sql
-- Ver turnos actualmente abiertos
SELECT 
  id,
  store_id,
  opening_amount,
  opened_at,
  (SELECT email FROM auth.users WHERE id = cash_shifts.user_id) as user_email
FROM cash_shifts 
WHERE status = 'OPEN'
ORDER BY opened_at DESC;
```

Si ves turnos abiertos que no deberían estar abiertos, ejecuta:

```bash
# En tu terminal, desde la raíz del proyecto:
npx supabase db execute --file supabase/CLOSE_ALL_OPEN_SHIFTS.sql
```

### Paso 2: Verificar y Remover Restricciones

Ejecuta este script para verificar y remover cualquier restricción que bloquee múltiples turnos:

```bash
npx supabase db execute --file supabase/FIX_CASH_SHIFTS_MULTI_STORE.sql
```

Este script:
- Muestra los turnos abiertos actuales
- Verifica si hay restricciones UNIQUE bloqueando múltiples turnos
- Remueve automáticamente cualquier restricción encontrada
- Verifica los triggers y políticas RLS

### Paso 3: Limpiar Caché del Navegador

1. Abre las DevTools (F12)
2. Haz clic derecho en el botón de recargar
3. Selecciona "Vaciar caché y recargar de forma forzada"

O simplemente:
- Chrome/Edge: `Ctrl + Shift + Delete`
- Selecciona "Imágenes y archivos en caché"
- Haz clic en "Borrar datos"

### Paso 4: Probar la Funcionalidad

1. Ve a `/cash` en tu aplicación
2. Deberías ver un formulario para "Abrir Turno de Caja"
3. Selecciona "Tienda de Hombres" y abre un turno
4. Deberías ver el turno abierto en la parte superior
5. Debajo, deberías ver otro formulario para abrir turno
6. Selecciona "Tienda de Mujeres" y abre otro turno
7. Ahora deberías ver ambos turnos abiertos simultáneamente

## Cómo Funciona Ahora

### Para Usuarios Admin
- Puedes ver y gestionar turnos de AMBAS tiendas
- Puedes abrir turnos para ambas tiendas simultáneamente
- Puedes cerrar turnos de cualquier tienda
- Puedes registrar gastos en cualquier turno

### Para Usuarios Cajero (Futuro)
Cuando crees usuarios con rol "cajero" y los asignes a una tienda específica:
- Solo verán los turnos de su tienda asignada
- Solo podrán abrir/cerrar turnos de su tienda
- No verán información de otras tiendas

## Código Relevante

### `actions/cash.ts`
```typescript
export async function openCashShift(storeId: string, openingAmount: number) {
  // No validation needed - allow opening shifts for any store
  // Multiple users (including admin) can manage different stores simultaneously
  
  const { data: shift, error } = await supabase
    .from('cash_shifts')
    .insert({
      store_id: storeId,
      user_id: user.id,
      opening_amount: openingAmount,
      status: 'OPEN'
    })
    .select()
    .single()
}
```

### `components/cash/cash-shift-manager.tsx`
```typescript
// Get available stores (stores without open shifts)
const openStoreIds = openShifts.map(shift => shift.store_id)
const availableStores = [
  { id: 'TIENDA_HOMBRES', name: 'Tienda de Hombres' },
  { id: 'TIENDA_MUJERES', name: 'Tienda de Mujeres' }
].filter(store => !openStoreIds.includes(store.id))
```

## Verificación Final

Después de ejecutar los scripts, verifica:

```sql
-- No debe haber restricciones UNIQUE en (store_id, status)
SELECT 
  conname,
  pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'cash_shifts'::regclass
  AND contype = 'u';

-- Debe retornar 0 filas o solo la primary key
```

## Soporte

Si después de seguir estos pasos aún tienes problemas:

1. Verifica que tu usuario tenga el rol 'admin':
```sql
SELECT email, roles 
FROM users 
WHERE email = 'gianpepex@gmail.com';
```

2. Verifica las políticas RLS:
```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'cash_shifts';
```

3. Revisa los logs del navegador (F12 > Console) para ver errores específicos
