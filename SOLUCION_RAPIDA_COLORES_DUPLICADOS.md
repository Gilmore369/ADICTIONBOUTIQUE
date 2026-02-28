# 🚨 Solución Rápida: Colores Duplicados

## Problema Actual

Tienes dos productos separados que deberían ser uno solo:
- **JEA-0004** Pantalón jean Denim (color beige) - 20 uds
- **JEA-0033** Pantalón jean Denim (color verde) - 8 uds

Deberían aparecer como:
- **JEA-0004** Pantalón jean Denim
  - Color beige (20 uds)
  - Color verde (8 uds)

---

## Causa del Problema

Cuando agregaste el nuevo color, el sistema generó un nuevo código (JEA-0033) en lugar de mantener el mismo (JEA-0004). Esto pasó porque:

1. No usaste la función de "Buscar Modelo Existente"
2. O cambiaste la categoría después de cargar el modelo
3. El sistema generó un nuevo código automáticamente

---

## Solución Inmediata

### Opción 1: Corrección Automática (Recomendado)

Ejecuta este script en Supabase SQL Editor:

```
supabase/FIX_UNIFICAR_MODELOS_DUPLICADOS.sql
```

Este script:
- ✅ Encuentra automáticamente todos los modelos duplicados
- ✅ Unifica el `base_code` al más antiguo (JEA-0004)
- ✅ Agrupa todos los colores bajo el mismo modelo
- ✅ Es seguro ejecutarlo múltiples veces

### Opción 2: Corrección Manual Específica

Si solo quieres corregir "Pantalón jean Denim":

```
supabase/FIX_UNIFICAR_BASE_CODE.sql
```

---

## Verificación

Después de ejecutar el script, verifica en el catálogo visual:

**Antes:**
```
┌─────────────────────┐  ┌─────────────────────┐
│ JEA-0004            │  │ JEA-0033            │
│ Pantalón jean Denim │  │ Pantalón jean Denim │
│ 🟡 Beige            │  │ 🟢 Verde            │
│ 20 uds              │  │ 8 uds               │
└─────────────────────┘  └─────────────────────┘
```

**Después:**
```
┌─────────────────────┐
│ JEA-0004            │
│ Pantalón jean Denim │
│ 🟡 Beige  🟢 Verde  │
│ 28 uds total        │
└─────────────────────┘
```

---

## Cómo Evitar Este Problema en el Futuro

### ✅ Flujo Correcto para Agregar un Nuevo Color:

1. **Selecciona el Proveedor** (requerido)

2. **Busca el modelo existente**
   - Escribe el nombre en el buscador
   - Ejemplo: "Pantalón jean Denim"

3. **Haz clic en el resultado**
   - El sistema carga automáticamente:
     - ✅ Mismo código (JEA-0004)
     - ✅ Mismo nombre
     - ✅ Misma categoría
     - ✅ Misma marca
     - ⚠️ Color VACÍO (para que ingreses el nuevo)

4. **Verifica el banner amarillo**
   ```
   📦 Agregando nuevo color al modelo existente
   Este modelo ya existe con código JEA-0004...
   ```

5. **Ingresa el NUEVO color**
   - Ejemplo: "Verde"
   - NO cambies ningún otro campo

6. **Selecciona tallas y cantidades**

7. **Guarda**

### ❌ Errores Comunes que Causan Duplicados:

1. **No buscar el modelo existente**
   - Crear un modelo nuevo desde cero
   - Resultado: Se genera un código nuevo

2. **Cambiar la categoría**
   - Después de cargar el modelo, cambiar la categoría
   - Resultado: Se genera un código nuevo

3. **Escribir el código manualmente**
   - Intentar poner el código a mano
   - Resultado: El campo está deshabilitado, pero si lo habilitas causa problemas

---

## Scripts Disponibles

### 1. Diagnóstico
```sql
supabase/DIAGNOSTICO_COLORES_DUPLICADOS.sql
```
- Muestra todos los productos con el mismo nombre pero diferentes códigos
- Útil para ver qué modelos están duplicados

### 2. Corrección Específica
```sql
supabase/FIX_UNIFICAR_BASE_CODE.sql
```
- Corrige solo "Pantalón jean Denim"
- Unifica al código JEA-0004

### 3. Corrección Automática (Recomendado)
```sql
supabase/FIX_UNIFICAR_MODELOS_DUPLICADOS.sql
```
- Encuentra y corrige TODOS los modelos duplicados
- Usa el código más antiguo para cada modelo
- Muestra un reporte completo

---

## Pasos para Ejecutar la Corrección

1. **Abre Supabase Dashboard**
   - Ve a tu proyecto
   - Haz clic en "SQL Editor"

2. **Crea una nueva query**
   - Haz clic en "New query"

3. **Copia y pega el script**
   - Usa: `supabase/FIX_UNIFICAR_MODELOS_DUPLICADOS.sql`

4. **Ejecuta**
   - Haz clic en "Run"
   - Espera a que termine

5. **Verifica el resultado**
   - Lee el resumen que aparece
   - Debe decir: "✅ Corrección completada"

6. **Refresca el catálogo visual**
   - Ctrl + Shift + R (Windows/Linux)
   - Cmd + Shift + R (Mac)

---

## Verificación en Base de Datos

Para verificar manualmente que se corrigió:

```sql
SELECT 
  base_code,
  base_name,
  color,
  COUNT(*) as variantes,
  STRING_AGG(size, ', ') as tallas
FROM products
WHERE base_name = 'Pantalón jean Denim'
GROUP BY base_code, base_name, color
ORDER BY color;
```

**Resultado esperado:**
```
base_code | base_name            | color | variantes | tallas
----------|---------------------|-------|-----------|-------------
JEA-0004  | Pantalón jean Denim | Beige | 4         | 32,34,36,38
JEA-0004  | Pantalón jean Denim | Verde | 2         | 36,38
```

Ambos deben tener el mismo `base_code` (JEA-0004).

---

## Preguntas Frecuentes

### ¿Perderé datos al ejecutar el script?
No. El script solo actualiza el campo `base_code`. No elimina productos ni stock.

### ¿Puedo ejecutar el script varias veces?
Sí, es seguro ejecutarlo múltiples veces. Solo actualiza lo que necesita.

### ¿Qué pasa con el código JEA-0033?
Dejará de usarse. Todos los productos que lo tenían ahora usarán JEA-0004.

### ¿Afecta a las ventas o movimientos?
No. Las ventas y movimientos se mantienen intactos. Solo se actualiza la agrupación visual.

### ¿Cómo sé si funcionó?
Verás en el catálogo visual que ambos colores aparecen en la misma tarjeta.

---

## Resumen

1. ✅ **Ejecuta**: `supabase/FIX_UNIFICAR_MODELOS_DUPLICADOS.sql`
2. ✅ **Verifica**: Catálogo visual debe mostrar un solo modelo con múltiples colores
3. ✅ **Futuro**: Usa siempre "Buscar Modelo Existente" para agregar colores

El problema se soluciona en menos de 1 minuto ejecutando el script.
