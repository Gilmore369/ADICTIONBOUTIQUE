# Explicación: Problema de Deuda Pendiente

## 🔴 Problema Actual

Tu cliente **Gianfranco Valdemar** muestra:

```
Límite de Crédito:    S/ 5,000.00
Deuda Pendiente:      S/ 24,029.64  ❌ INCORRECTO
Crédito Disponible:   S/ 0.00       ❌ INCORRECTO
```

Pero cuando revisas sus cuotas, **todas están pagadas** ✅

## 🤔 ¿Por Qué Pasa Esto?

El campo `credit_used` en la base de datos está sumando **TODAS las compras a crédito históricas**, incluyendo las que ya fueron pagadas completamente.

### Ejemplo Real:

```
Cliente compró:
- Diciembre 2025: S/ 8,000.00 → Pagó todo ✅
- Enero 2026:     S/ 10,000.00 → Pagó todo ✅
- Febrero 2026:   S/ 6,029.64 → Pagó todo ✅
                  ─────────────
Total histórico:  S/ 24,029.64

credit_used actual = S/ 24,029.64 ❌ (suma todo lo histórico)
credit_used correcto = S/ 0.00 ✅ (solo lo que debe ahora)
```

## ✅ Solución

El campo `credit_used` debe calcularse como:

```sql
credit_used = SUMA de (monto_cuota - monto_pagado)
              SOLO de cuotas con estado:
              - PENDING (pendiente)
              - PARTIAL (parcialmente pagada)
              - OVERDUE (vencida)
```

### Después de la Corrección:

```
Límite de Crédito:    S/ 5,000.00
Deuda Pendiente:      S/ 0.00       ✅ CORRECTO
Crédito Disponible:   S/ 5,000.00   ✅ CORRECTO
```

## 📊 Cómo Funciona el Cálculo Correcto

### Caso 1: Cliente sin deuda

```
Cuotas:
- Cuota 1: S/ 500 - Estado: PAID ✅
- Cuota 2: S/ 500 - Estado: PAID ✅
- Cuota 3: S/ 500 - Estado: PAID ✅

credit_used = S/ 0.00 (ninguna cuota pendiente)
```

### Caso 2: Cliente con deuda parcial

```
Cuotas:
- Cuota 1: S/ 500 - Estado: PAID ✅
- Cuota 2: S/ 500 - Estado: PENDING ⏳
- Cuota 3: S/ 500 - Estado: PENDING ⏳

credit_used = S/ 1,000.00 (solo cuotas 2 y 3)
```

### Caso 3: Cliente con pago parcial

```
Cuotas:
- Cuota 1: S/ 500 - Pagado: S/ 500 - Estado: PAID ✅
- Cuota 2: S/ 500 - Pagado: S/ 300 - Estado: PARTIAL ⚠️
- Cuota 3: S/ 500 - Pagado: S/ 0   - Estado: PENDING ⏳

credit_used = S/ 700.00
  = (500 - 300) + (500 - 0)
  = 200 + 500
```

## 🔧 Cómo Corregir

1. **Ejecuta el script** `supabase/RECALCULAR_DEUDA_PENDIENTE.sql`
2. **Refresca tu aplicación** (F5)
3. **Verifica** que los clientes que pagaron todo muestren S/ 0.00

## 🛡️ Prevención Automática

Ya existe un **trigger en la base de datos** que recalcula automáticamente `credit_used` cada vez que:

- ✅ Se crea una nueva cuota
- ✅ Se actualiza el estado de una cuota
- ✅ Se registra un pago

Por lo tanto, **solo necesitas ejecutar el script una vez** para corregir los datos históricos.

## 📝 Resumen

| Concepto | Antes (Incorrecto) | Después (Correcto) |
|----------|-------------------|-------------------|
| **credit_used** | Total histórico de compras | Solo deuda pendiente actual |
| **Incluye cuotas PAID** | ❌ Sí | ✅ No |
| **Incluye cuotas PENDING** | ✅ Sí | ✅ Sí |
| **Incluye cuotas PARTIAL** | ✅ Sí | ✅ Sí (solo lo que falta) |
| **Incluye cuotas OVERDUE** | ✅ Sí | ✅ Sí |

## 🎯 Resultado Final

Después de ejecutar el script, tu sistema mostrará correctamente:

- **Deuda Pendiente**: Solo lo que el cliente debe AHORA
- **Crédito Disponible**: Límite - Deuda Pendiente
- **Utilización**: Porcentaje real de crédito usado

Esto te permitirá:
- ✅ Ver quiénes realmente tienen deuda
- ✅ Saber cuánto crédito disponible tiene cada cliente
- ✅ Tomar decisiones correctas sobre nuevas ventas a crédito
- ✅ Generar reportes precisos de cobranza
