# Instrucciones Rápidas - Corrección Completada

## ✅ Problemas Resueltos

### 1. Moneda y Formato
- Cambiado de `$` a `S/` (Sol Peruano)
- Agregado separador de miles: `S/ 5,000.00` en lugar de `$5000.00`
- Formato aplicado en todos los componentes principales

### 2. "Crédito Usado" → "Deuda Pendiente"
- El sistema YA calculaba correctamente (solo deuda pendiente, no histórico)
- Cambiado el nombre para mayor claridad
- Creado script de verificación por si hay inconsistencias

### 3. Mapa de Deudores
- Agregadas coordenadas de Trujillo a todos los clientes
- Ahora los clientes aparecen en el mapa

## 🚀 Qué Hacer Ahora

### ⚠️ IMPORTANTE: Errores Corregidos
Los scripts han sido corregidos para evitar errores de sintaxis y foreign keys.

### Opción 1: Solo Agregar Coordenadas (RECOMENDADO)
Si solo quieres agregar coordenadas sin tocar otros datos:

```sql
-- Ejecuta en Supabase SQL Editor:
-- supabase/CORREGIR_SOLO_COORDENADAS.sql
```

### Opción 2: Recalcular Credit_Used
Si sospechas que hay inconsistencias en la deuda:

```sql
-- Ejecuta en Supabase SQL Editor:
-- supabase/RECALCULAR_CREDIT_USED.sql
```

### Opción 3: Corrección Completa
Para hacer ambas cosas a la vez:

```sql
-- Ejecuta en Supabase SQL Editor:
-- supabase/FIX_CREDIT_AND_COORDINATES.sql
```

### Opción 4: Datos Nuevos (Empezar de Cero)
Si quieres empezar con datos frescos:

```sql
-- Ejecuta en Supabase SQL Editor:
-- supabase/SEED_FINAL.sql
```

⚠️ Este script elimina datos existentes con teléfonos 555-*

## 📝 Scripts Disponibles

### Scripts de Corrección (No eliminan datos)
1. `CORREGIR_SOLO_COORDENADAS.sql` - Solo agrega coordenadas
2. `RECALCULAR_CREDIT_USED.sql` - Solo recalcula deuda
3. `FIX_CREDIT_AND_COORDINATES.sql` - Hace ambas cosas

### Scripts de Datos Nuevos (Eliminan datos de prueba)
1. `SEED_FINAL.sql` - Carga 3 meses de datos completos

## 📍 Probar el Mapa

1. Ejecuta `CORREGIR_SOLO_COORDENADAS.sql`
2. Ve a `/map` en tu aplicación
3. Deberías ver clientes en el mapa de Trujillo
4. Prueba los filtros:
   - **Atrasados**: Clientes con pagos vencidos (rojo)
   - **Próximos a Vencer**: Cuotas en los próximos 7 días (amarillo)
   - **Al Día**: Mejores clientes sin atrasos (verde)
   - **Todos con Crédito**: Todos los clientes con deuda (azul)

## 💰 Verificar Formato de Moneda

Revisa estas páginas para ver el nuevo formato:
- `/clients` - Lista de clientes
- `/clients/[id]` - Detalle de cliente
- `/debt/plans` - Planes de crédito
- `/collections/payments` - Historial de pagos

Deberías ver:
- ✅ `S/ 5,000.00` (con separador de miles)
- ❌ `$5000.00` (formato antiguo)

## 📊 Entender "Deuda Pendiente"

**Antes:** "Crédito Usado" (confuso)
**Ahora:** "Deuda Pendiente" (claro)

**Fórmula:**
```
Deuda Pendiente = Suma de todas las cuotas pendientes
                = Σ (Monto Cuota - Monto Pagado)
                  para cuotas PENDING, PARTIAL, OVERDUE
```

**Ejemplo:**
- Cliente tiene 3 cuotas de S/ 100 cada una
- Ha pagado S/ 50 de la primera cuota
- Deuda Pendiente = (100 - 50) + 100 + 100 = S/ 250

## 🔧 Archivos Importantes

### Scripts SQL (Corrección)
- `supabase/CORREGIR_SOLO_COORDENADAS.sql` - Solo coordenadas ⭐ RECOMENDADO
- `supabase/RECALCULAR_CREDIT_USED.sql` - Solo deuda
- `supabase/FIX_CREDIT_AND_COORDINATES.sql` - Ambos

### Scripts SQL (Datos Nuevos)
- `supabase/SEED_FINAL.sql` - Datos completos de 3 meses

### Documentación
- `CORRECCION_CREDITO_Y_MAPA.md` - Documentación completa
- `INSTRUCCIONES_RAPIDAS.md` - Este archivo

### Código
- `lib/utils/currency.ts` - Funciones de formato de moneda
- Componentes actualizados (ver CORRECCION_CREDITO_Y_MAPA.md)

## ❓ Preguntas Frecuentes

### ¿Qué script debo ejecutar primero?
Empieza con `CORREGIR_SOLO_COORDENADAS.sql` - es el más seguro y solo agrega coordenadas.

### ¿Los scripts eliminan datos?
- ❌ `CORREGIR_SOLO_COORDENADAS.sql` - NO elimina nada
- ❌ `RECALCULAR_CREDIT_USED.sql` - NO elimina nada
- ❌ `FIX_CREDIT_AND_COORDINATES.sql` - NO elimina nada
- ⚠️ `SEED_FINAL.sql` - SÍ elimina datos de prueba (teléfonos 555-*)

### ¿Por qué "Deuda Pendiente" en lugar de "Crédito Usado"?
Porque es más claro. "Crédito Usado" suena como el total histórico, pero en realidad es solo lo que falta pagar.

### ¿El sistema calculaba mal antes?
No, el cálculo era correcto. Solo el nombre era confuso.

### ¿Necesito ejecutar el script de recalcular credit_used?
Solo si sospechas que hay inconsistencias. El sistema debería calcular correctamente automáticamente.

### ¿Todos los clientes son de Trujillo?
Sí, los datos de prueba son de Trujillo. Las coordenadas están en el área urbana de Trujillo.

### ¿Qué hago si veo un error de foreign key?
Usa los scripts de corrección (CORREGIR_SOLO_COORDENADAS.sql) en lugar de SEED_FINAL.sql. Los scripts de corrección no eliminan datos.

## 🎯 Pasos Recomendados

1. ✅ Ejecuta `CORREGIR_SOLO_COORDENADAS.sql`
2. ✅ Verifica el mapa en `/map`
3. ✅ Revisa el formato de moneda en `/clients`
4. ✅ Si hay problemas con deuda, ejecuta `RECALCULAR_CREDIT_USED.sql`

¡Listo! Todo debería funcionar correctamente ahora.
