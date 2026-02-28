# Corrección: Deuda Pendiente (credit_used)

## Problema Identificado

El campo `credit_used` en la tabla `clients` muestra valores incorrectos:

- **Ejemplo**: Cliente con límite de S/ 5,000.00 muestra deuda de S/ 24,029.64
- **Causa**: `credit_used` suma TODAS las compras a crédito históricas, sin restar los pagos realizados

### ¿Por qué ocurre esto?

En el script de seed (`SEED_FINAL.sql`), cuando se crea una venta a crédito:

```sql
-- Se suma el total de la venta
UPDATE clients 
SET credit_used = credit_used + sale_total 
WHERE id = client_id;
```

Pero cuando el cliente paga una cuota, NO se resta de `credit_used`. Esto hace que:

- `credit_used` = Total histórico de compras a crédito
- NO refleja la deuda pendiente actual
- Puede exceder el límite de crédito

## Solución Implementada

### 1. Función de Recálculo

Se creó la función `recalculate_client_credit_used()` que calcula la deuda pendiente real:

```sql
credit_used = SUM(installments.amount - installments.paid_amount)
WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE')
```

### 2. Trigger Automático

Se creó un trigger que recalcula `credit_used` automáticamente cuando:
- Se crea una nueva cuota
- Se actualiza una cuota (ej: se registra un pago)
- Se elimina una cuota

### 3. Scripts de Corrección

Se crearon 3 scripts SQL:

#### `CORREGIR_DEUDA_PENDIENTE.sql` (RECOMENDADO)
Script maestro que ejecuta todo en orden:
1. Crea/actualiza la función de recálculo
2. Crea/actualiza el trigger automático
3. Genera algunos pagos de ejemplo (opcional)
4. Recalcula `credit_used` para todos los clientes

#### `RECALCULAR_CREDIT_USED.sql`
Solo recalcula `credit_used` para todos los clientes (sin generar pagos).

#### `GENERAR_PAGOS_EJEMPLO.sql`
Genera pagos aleatorios para simular que algunos clientes han pagado.

## Cómo Ejecutar la Corrección

### Opción 1: Script Maestro (Recomendado)

```bash
# Desde Supabase SQL Editor o terminal
psql -h <host> -U <user> -d <database> -f supabase/CORREGIR_DEUDA_PENDIENTE.sql
```

O desde Supabase Dashboard:
1. Ir a SQL Editor
2. Abrir el archivo `supabase/CORREGIR_DEUDA_PENDIENTE.sql`
3. Ejecutar

### Opción 2: Solo Recalcular (Sin Pagos)

Si no quieres generar pagos de ejemplo:

```bash
psql -h <host> -U <user> -d <database> -f supabase/RECALCULAR_CREDIT_USED.sql
```

## Resultado Esperado

Después de ejecutar el script:

### Antes
```
Cliente: Gianfranco Valdemar
Límite de Crédito: S/ 5,000.00
Deuda Pendiente: S/ 24,029.64  ❌ (Incorrecto)
Crédito Disponible: S/ 0.00
```

### Después
```
Cliente: Gianfranco Valdemar
Límite de Crédito: S/ 5,000.00
Deuda Pendiente: S/ 3,450.00  ✅ (Correcto - solo cuotas pendientes)
Crédito Disponible: S/ 1,550.00
```

## Comportamiento Futuro

Una vez ejecutado el script, el sistema funcionará correctamente:

1. **Al crear una venta a crédito**: El trigger recalcula `credit_used` basándose en las cuotas creadas
2. **Al registrar un pago**: El trigger recalcula `credit_used` automáticamente
3. **Al actualizar una cuota**: El trigger mantiene `credit_used` sincronizado

## Verificación

Para verificar que la corrección funcionó:

```sql
-- Ver clientes con mayor deuda
SELECT 
  name,
  credit_limit,
  credit_used AS deuda_pendiente,
  credit_limit - credit_used AS credito_disponible,
  ROUND((credit_used / NULLIF(credit_limit, 0)) * 100, 1) AS utilizacion_pct
FROM clients
WHERE credit_limit > 0
ORDER BY credit_used DESC
LIMIT 10;

-- Ver estadísticas generales
SELECT 
  COUNT(*) AS total_clientes,
  COUNT(*) FILTER (WHERE credit_used > 0) AS clientes_con_deuda,
  SUM(credit_limit) AS limite_total,
  SUM(credit_used) AS deuda_total,
  SUM(credit_limit - credit_used) AS credito_disponible_total
FROM clients
WHERE credit_limit > 0;
```

## Notas Importantes

1. **Migración ya existe**: La migración `20240224000000_fix_credit_used_logic.sql` ya implementa esta solución, pero los datos de seed la sobrescribieron.

2. **Idempotente**: Los scripts pueden ejecutarse múltiples veces sin problemas.

3. **Pagos de ejemplo**: El script genera algunos pagos aleatorios para que veas cómo funciona el sistema cuando los clientes pagan. Puedes omitir esta parte si prefieres.

4. **Automático**: Una vez ejecutado, no necesitas hacer nada más. El sistema se actualizará automáticamente.

## Archivos Relacionados

- `supabase/CORREGIR_DEUDA_PENDIENTE.sql` - Script maestro (ejecutar este)
- `supabase/RECALCULAR_CREDIT_USED.sql` - Solo recálculo
- `supabase/GENERAR_PAGOS_EJEMPLO.sql` - Solo generar pagos
- `supabase/migrations/20240224000000_fix_credit_used_logic.sql` - Migración original
- `supabase/FIX_CREDIT_USED.sql` - Script anterior (similar)

