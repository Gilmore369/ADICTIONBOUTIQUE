# Corrección de Formato de Moneda

## Problema Identificado

1. **Crédito disponible negativo**: El sistema muestra valores negativos cuando el crédito usado excede el límite
2. **Símbolo de moneda incorrecto**: Se usa `$` en lugar de `S/` (Soles Peruanos)
3. **Sin separadores de miles**: Los montos no tienen formato con comas

## Solución Implementada

### 1. Utilidad de Formateo de Moneda

Creado: `lib/utils/currency.ts`

Funciones disponibles:
- `formatCurrency(amount)` - Formatea como "S/ 1,234.56"
- `getAvailableCredit(limit, used)` - Calcula crédito disponible (nunca negativo)
- `getCreditColor(available)` - Retorna color según disponibilidad

### 2. Componentes Actualizados

- ✅ `components/clients/credit-summary-card.tsx` - Resumen de crédito
- ✅ `components/clients/dashboard-metrics.tsx` - Métricas del dashboard

### 3. Componentes Pendientes de Actualizar

Los siguientes componentes aún usan el formato antiguo:

#### Alta Prioridad
- `components/clients/client-profile-view.tsx` - Vista de perfil del cliente
- `components/clients/installments-table.tsx` - Tabla de cuotas
- `components/clients/purchase-history-table.tsx` - Historial de compras
- `components/pos/client-selector.tsx` - Selector de clientes en POS

#### Media Prioridad
- `components/collections/payment-form.tsx` - Formulario de pagos
- `components/clients/alerts-list.tsx` - Lista de alertas
- `components/map/client-map.tsx` - Mapa de clientes

## Pasos para Completar la Corrección

### Paso 1: Importar la utilidad

En cada componente, agregar:
```typescript
import { formatCurrency, getAvailableCredit } from '@/lib/utils/currency'
```

### Paso 2: Reemplazar formatos

Buscar y reemplazar:
- `${amount.toFixed(2)}` → `{formatCurrency(amount)}`
- `$${amount.toFixed(2)}` → `{formatCurrency(amount)}`
- `S/ ${amount.toFixed(2)}` → `{formatCurrency(amount)}`

### Paso 3: Validar crédito disponible

Para cálculos de crédito disponible:
```typescript
// Antes
const available = creditLimit - creditUsed

// Después
const available = getAvailableCredit(creditLimit, creditUsed)
```

## Ejemplos de Uso

### Formato Básico
```typescript
formatCurrency(1234.56)  // "S/ 1,234.56"
formatCurrency(0)        // "S/ 0.00"
formatCurrency(-500)     // "S/ -500.00"
```

### Crédito Disponible
```typescript
// Evita valores negativos
getAvailableCredit(5000, 3000)   // 2000
getAvailableCredit(5000, 6000)   // 0 (no negativo)
```

### Color Dinámico
```typescript
getCreditColor(2000)   // "text-green-600"
getCreditColor(500)    // "text-yellow-600"
getCreditColor(0)      // "text-red-600"
```

## Verificación

Después de aplicar los cambios, verificar:

1. ✅ Todos los montos muestran "S/" en lugar de "$"
2. ✅ Los montos tienen separadores de miles (1,234.56)
3. ✅ El crédito disponible nunca es negativo
4. ✅ Los colores cambian según la disponibilidad

## Archivos Modificados

- ✅ `lib/utils/currency.ts` (nuevo)
- ✅ `components/clients/credit-summary-card.tsx`
- ✅ `components/clients/dashboard-metrics.tsx`

## Próximos Pasos

1. Actualizar componentes de alta prioridad
2. Actualizar componentes de media prioridad
3. Buscar y actualizar cualquier otro componente que muestre montos
4. Actualizar reportes y exportaciones
5. Verificar en toda la aplicación

## Notas

- La función `formatCurrency` usa `Intl.NumberFormat` con locale 'es-PE'
- Los separadores de miles son comas (,)
- Los decimales usan punto (.)
- El formato es: S/ 1,234.56
