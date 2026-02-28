# Corrección de Crédito y Mapa de Deudores

## Problemas Corregidos

### 1. Formato de Moneda
- ✅ Cambiado de `$` a `S/` (Sol Peruano)
- ✅ Agregado separador de miles (5,000.00 en lugar de 5000.00)
- ✅ Formato consistente en toda la aplicación

### 2. Crédito Usado (Deuda Pendiente)
El problema era conceptual. El sistema YA estaba calculando correctamente:
- `credit_used` se incrementa cuando se hace una venta a crédito
- `credit_used` se decrementa cuando se registra un pago
- Por lo tanto, `credit_used` SIEMPRE representa la deuda pendiente actual

**Cambios realizados:**
- ✅ Renombrado "Crédito Usado" a "Deuda Pendiente" para mayor claridad
- ✅ Creado script `FIX_CREDIT_AND_COORDINATES.sql` para recalcular `credit_used` basado en cuotas pendientes (por si hay inconsistencias)
- ✅ El script verifica que `credit_used` = suma de (amount - paid_amount) de todas las cuotas PENDING/PARTIAL/OVERDUE

### 3. Mapa de Deudores
- ✅ Agregadas coordenadas (lat/lng) a todos los clientes en Trujillo
- ✅ Actualizado `SEED_FINAL.sql` para incluir coordenadas al crear clientes
- ✅ Script `FIX_CREDIT_AND_COORDINATES.sql` agrega coordenadas a clientes existentes

### 4. Utilidades de Formato
Creado archivo `lib/utils/currency.ts` con funciones:
- `formatCurrency(amount)` - Formatea como S/ 1,234.56
- `formatNumber(amount)` - Formatea con separadores de miles
- `calculateAvailableCredit()` - Calcula crédito disponible (nunca negativo)
- `calculateCreditUtilization()` - Calcula % de utilización
- `getCreditColor()` - Retorna color según nivel de utilización
- `getAvailableCredit()` - Retorna objeto con crédito disponible y utilización

## Archivos Modificados

### Utilidades
- `lib/utils/currency.ts` - Creado con funciones de formato

### Componentes Actualizados (usando formatCurrency)
- `components/clients/credit-summary-card.tsx`
- `components/clients/client-detail-view.tsx`
- `components/clients/client-credit-plans.tsx`
- `components/clients/client-profile.tsx`
- `components/clients/clients-table.tsx`
- `components/clients/client-purchase-history.tsx`
- `components/debt/installments-table.tsx`
- `components/collections/payment-history.tsx`
- `components/clients/dashboard-metrics.tsx`

### Scripts SQL
- `supabase/FIX_CREDIT_AND_COORDINATES.sql` - Script de corrección
- `supabase/SEED_FINAL.sql` - Actualizado con coordenadas

## Cómo Usar

### Paso 1: Ejecutar Script de Corrección
```sql
-- En Supabase SQL Editor, ejecuta:
-- supabase/FIX_CREDIT_AND_COORDINATES.sql
```

Este script:
1. Recalcula `credit_used` para todos los clientes basado en cuotas pendientes
2. Agrega coordenadas (lat/lng) a clientes sin coordenadas
3. Muestra verificación final con estadísticas

### Paso 2: Verificar Resultados
El script mostrará:
- Clientes con deuda pendiente
- Clientes con coordenadas
- Resumen de deuda total, promedio y máxima

### Paso 3: Probar el Mapa
1. Ve a `/map` en la aplicación
2. Deberías ver todos los clientes con deuda en el mapa de Trujillo
3. Prueba los diferentes filtros:
   - Atrasados (rojo/naranja/amarillo según monto)
   - Próximos a Vencer (naranja/amarillo según monto)
   - Al Día (verde)
   - Todos con Crédito (azul/amarillo/naranja/rojo según % uso)

## Coordenadas de Trujillo
- Centro: -8.1116, -79.0288
- Área cubierta: ~4km de radio
- Clientes distribuidos aleatoriamente en el área urbana

## Fórmulas

### Crédito Disponible
```
Crédito Disponible = Límite de Crédito - Deuda Pendiente
```

### Deuda Pendiente (credit_used)
```
Deuda Pendiente = Σ (Monto Cuota - Monto Pagado) 
                  para todas las cuotas con estado PENDING, PARTIAL o OVERDUE
```

### Utilización de Crédito
```
Utilización % = (Deuda Pendiente / Límite de Crédito) × 100
```

## Colores de Indicadores

### Utilización de Crédito
- Verde: < 50%
- Amarillo: 50-75%
- Naranja: 75-90%
- Rojo: ≥ 90%

### Mapa - Atrasados
- Verde: < S/ 100
- Amarillo: S/ 100-300
- Naranja: S/ 300-500
- Rojo: > S/ 500

### Mapa - Próximos a Vencer
- Verde: < S/ 150
- Amarillo: S/ 150-300
- Naranja: > S/ 300

## Notas Importantes

1. **credit_used es correcto**: El sistema ya estaba calculando correctamente la deuda pendiente. Solo se cambió el nombre de "Crédito Usado" a "Deuda Pendiente" para mayor claridad.

2. **Script de recalculación**: El script `FIX_CREDIT_AND_COORDINATES.sql` es útil para corregir inconsistencias si las hay, pero en teoría no debería ser necesario si el sistema funciona correctamente.

3. **Coordenadas**: Todos los clientes nuevos creados con `SEED_FINAL.sql` ya incluyen coordenadas. Los clientes existentes necesitan ejecutar el script de corrección.

4. **Formato consistente**: Todos los montos ahora usan `formatCurrency()` que garantiza:
   - Símbolo correcto (S/)
   - Separadores de miles
   - 2 decimales
   - Formato peruano (es-PE)
