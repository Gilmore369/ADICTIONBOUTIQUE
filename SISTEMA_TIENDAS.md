# Sistema de Tiendas - Configuración

## 🏪 Tiendas Configuradas

Tu empresa tiene 2 ubicaciones físicas:

1. **TIENDA_HOMBRES** - Tienda de Hombres
2. **TIENDA_MUJERES** - Tienda de Mujeres

Cada tienda tiene:
- ✅ Su propia caja independiente
- ✅ Turnos de caja separados
- ✅ Control de gastos individual
- ✅ Reportes independientes

## 👥 Sistema de Permisos por Tienda

### Usuario Actual (Admin General)
Tu usuario actual tiene acceso a AMBAS tiendas:
```sql
-- Tu usuario tiene acceso completo
roles = ARRAY['admin']
stores = ARRAY['TIENDA_HOMBRES', 'TIENDA_MUJERES']
```

### Usuarios por Tienda (Futuro)

Cuando crees usuarios específicos para cada tienda:

#### Cajero de Tienda de Hombres
```sql
INSERT INTO users (email, roles, stores) VALUES
('cajero.hombres@empresa.com', ARRAY['cajero'], ARRAY['TIENDA_HOMBRES']);
```
- ✅ Solo puede abrir caja en Tienda de Hombres
- ✅ Solo ve turnos de Tienda de Hombres
- ❌ No puede acceder a Tienda de Mujeres

#### Cajero de Tienda de Mujeres
```sql
INSERT INTO users (email, roles, stores) VALUES
('cajero.mujeres@empresa.com', ARRAY['cajero'], ARRAY['TIENDA_MUJERES']);
```
- ✅ Solo puede abrir caja en Tienda de Mujeres
- ✅ Solo ve turnos de Tienda de Mujeres
- ❌ No puede acceder a Tienda de Hombres

#### Gerente (Acceso a Ambas)
```sql
INSERT INTO users (email, roles, stores) VALUES
('gerente@empresa.com', ARRAY['admin'], ARRAY['TIENDA_HOMBRES', 'TIENDA_MUJERES']);
```
- ✅ Acceso completo a ambas tiendas
- ✅ Puede ver reportes consolidados
- ✅ Puede gestionar usuarios

## 🔐 Implementar Permisos por Tienda

Para activar el filtrado por tienda, necesitas actualizar las acciones:

### 1. Actualizar `actions/cash.ts`

```typescript
export async function openCashShift(storeId: string, openingAmount: number) {
  try {
    const supabase = await createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // Verificar que el usuario tenga acceso a esta tienda
    const { data: profile } = await supabase
      .from('users')
      .select('stores')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.stores?.includes(storeId)) {
      throw new Error('No tienes acceso a esta tienda')
    }

    // ... resto del código
  }
}
```

### 2. Filtrar Selector de Tiendas

Actualizar `components/cash/cash-shift-manager.tsx`:

```typescript
// Obtener tiendas del usuario
const [userStores, setUserStores] = useState<string[]>([])

useEffect(() => {
  async function loadUserStores() {
    const supabase = createClientComponentClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('stores')
        .eq('id', user.id)
        .single()
      
      setUserStores(profile?.stores || [])
    }
  }
  
  loadUserStores()
}, [])

// En el select, solo mostrar tiendas del usuario
<select>
  {userStores.includes('TIENDA_HOMBRES') && (
    <option value="TIENDA_HOMBRES">Tienda de Hombres</option>
  )}
  {userStores.includes('TIENDA_MUJERES') && (
    <option value="TIENDA_MUJERES">Tienda de Mujeres</option>
  )}
</select>
```

## 📊 Reportes por Tienda

### Ver Ventas por Tienda
```sql
SELECT 
  cs.store_id,
  COUNT(DISTINCT cs.id) as turnos,
  SUM(cs.closing_amount - cs.opening_amount) as diferencia_total,
  COUNT(s.id) as ventas_count,
  SUM(s.total_amount) as ventas_total
FROM cash_shifts cs
LEFT JOIN sales s ON DATE(s.created_at) = DATE(cs.opened_at)
WHERE cs.status = 'CLOSED'
  AND cs.opened_at >= '2025-12-01'
  AND cs.opened_at <= '2026-02-28'
GROUP BY cs.store_id;
```

### Ver Gastos por Tienda
```sql
SELECT 
  cs.store_id,
  ce.category,
  COUNT(*) as cantidad_gastos,
  SUM(ce.amount) as total_gastos
FROM cash_expenses ce
JOIN cash_shifts cs ON cs.id = ce.shift_id
WHERE cs.opened_at >= '2025-12-01'
  AND cs.opened_at <= '2026-02-28'
GROUP BY cs.store_id, ce.category
ORDER BY cs.store_id, total_gastos DESC;
```

## 🎯 Casos de Uso

### Caso 1: Apertura de Caja Diaria
**Tienda de Hombres - 8:00 AM**
1. Cajero inicia sesión
2. Ve solo "Tienda de Hombres" en el selector
3. Ingresa monto inicial: S/ 500.00
4. Abre turno

**Tienda de Mujeres - 8:30 AM**
1. Cajero inicia sesión
2. Ve solo "Tienda de Mujeres" en el selector
3. Ingresa monto inicial: S/ 500.00
4. Abre turno

### Caso 2: Cierre de Caja
**Tienda de Hombres - 8:00 PM**
1. Cuenta efectivo: S/ 2,350.00
2. Sistema calcula esperado: S/ 2,320.00
3. Diferencia: +S/ 30.00 (sobrante)
4. Cierra turno

**Tienda de Mujeres - 8:30 PM**
1. Cuenta efectivo: S/ 1,980.00
2. Sistema calcula esperado: S/ 2,000.00
3. Diferencia: -S/ 20.00 (faltante)
4. Cierra turno

### Caso 3: Gerente Revisa Ambas Tiendas
1. Inicia sesión como admin
2. Ve selector con ambas tiendas
3. Puede cambiar entre tiendas
4. Ve reportes consolidados

## 🔧 Configuración Actual

Actualmente el sistema está configurado para:
- ✅ 2 tiendas físicas (Hombres y Mujeres)
- ✅ Turnos independientes por tienda
- ✅ Gastos separados por tienda
- ⏳ Permisos por tienda (pendiente implementar)
- ⏳ Filtrado automático por usuario (pendiente)

## 📝 Próximos Pasos

1. ✅ Configurar nombres de tiendas - COMPLETADO
2. ⏳ Implementar filtrado por tienda en acciones
3. ⏳ Crear usuarios específicos por tienda
4. ⏳ Agregar reportes comparativos entre tiendas
5. ⏳ Dashboard con métricas por tienda

## 💡 Notas Importantes

- Los IDs de tienda (`TIENDA_HOMBRES`, `TIENDA_MUJERES`) son fijos en el código
- Si cambias los nombres, debes actualizar:
  - `components/cash/cash-shift-manager.tsx`
  - `supabase/seed_data_3_months.sql`
  - Cualquier dato existente en la base de datos
- Los datos de prueba generarán turnos para ambas tiendas
- Cada tienda puede tener múltiples turnos por día (si hay varios cajeros)
