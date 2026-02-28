# Validación de Líneas vs Tiendas

## Problema Identificado

Has detectado que hay productos de la línea "Hombres" apareciendo en la "Tienda Mujeres" (o viceversa). Esto puede ocurrir por dos razones:

### 1. Inconsistencia en el Seed de Datos

En el archivo `supabase/migrations/20260224000004_fresh_seed_data.sql`, el producto "Pantalón Jogger" (PAN-001) tiene:
- **Categoría**: `'22222222-0005-0000-0000-000000000000'` (Pantalones - que pertenece a la línea MUJERES)
- **Line_id**: `'11111111-0002-0000-0000-000000000000'` (Línea HOMBRES)

Esto es una **inconsistencia**: el producto dice ser de la línea "Hombres" pero usa una categoría de "Mujeres".

### 2. Lógica de Asignación de Warehouse

El script de seed asigna el warehouse basándose en el `line_id`:
```sql
CASE
  WHEN p.line_id = '11111111-0001-0000-0000-000000000000' THEN 'Mujeres'
  ELSE 'Hombres'
END AS warehouse_id
```

## Estructura Correcta

### Líneas (Product Lines):
- **Mujeres** (`11111111-0001-0000-0000-000000000000`)
  - Categorías: Blusas, Jeans, Vestidos, Casacas, Pantalones
- **Hombres** (`11111111-0002-0000-0000-000000000000`)
  - Categorías: Polos, Jeans, Camisas, Casacas
- **Niños** (`11111111-0003-0000-0000-000000000000`)
  - Categorías: Conjuntos
- **Accesorios** (`11111111-0004-0000-0000-000000000000`)
  - Categorías: (por definir)

### Tiendas (Physical Stores):
- **Tienda Mujeres** - Almacena productos de línea "Mujeres" y "Niños"
- **Tienda Hombres** - Almacena productos de línea "Hombres"

## Regla de Oro

**El `line_id` de un producto DEBE coincidir con el `line_id` de su categoría.**

Si un producto tiene:
- Categoría: "Pantalones" (que pertenece a línea "Mujeres")
- Entonces su `line_id` debe ser: "Mujeres"

## Cómo Diagnosticar

### Paso 1: Ejecutar Diagnóstico

Ejecuta en Supabase SQL Editor:
```
supabase/DIAGNOSTICO_LINEAS_TIENDAS.sql
```

Este script te mostrará:
1. ✅ Todas las líneas disponibles
2. ✅ Todas las categorías por línea
3. ✅ Productos con su línea y warehouse
4. ⚠️ **INCONSISTENCIAS**: Productos con line_id incorrecto
5. 📊 Resumen de líneas por tienda
6. 🔍 Productos con categoría de una línea pero line_id de otra

### Paso 2: Revisar Resultados

Busca la sección:
```
=== ⚠️ INCONSISTENCIAS DETECTADAS ===
```

Si aparecen productos aquí, significa que tienen un `line_id` que no coincide con la línea de su categoría.

### Paso 3: Revisar Resumen por Tienda

Busca la sección:
```
=== RESUMEN: LÍNEAS POR TIENDA ===
```

Deberías ver algo como:
```
tienda          | linea    | modelos | variantes | stock_total
----------------|----------|---------|-----------|------------
Tienda Mujeres  | Mujeres  | 5       | 45        | 450
Tienda Hombres  | Hombres  | 5       | 47        | 470
```

Si ves líneas mezcladas (ej: "Hombres" en "Tienda Mujeres"), hay un problema.

## Cómo Corregir

### Opción 1: Corrección Automática (Recomendado)

Ejecuta en Supabase SQL Editor:
```
supabase/FIX_LINEAS_PRODUCTOS.sql
```

Este script:
1. ✅ Identifica productos con `line_id` incorrecto
2. ✅ Corrige el `line_id` para que coincida con la línea de su categoría
3. ✅ Actualiza el `warehouse_id` en stock para que coincida con la nueva línea
4. ✅ Verifica que todo esté correcto
5. ✅ Muestra un resumen final

### Opción 2: Corrección Manual

Si prefieres corregir manualmente:

```sql
-- 1. Ver productos problemáticos
SELECT 
  p.barcode,
  p.name,
  l.name as linea_actual,
  cl.name as linea_correcta
FROM products p
JOIN lines l ON p.line_id = l.id
JOIN categories c ON p.category_id = c.id
JOIN lines cl ON c.line_id = cl.id
WHERE l.id != cl.id;

-- 2. Corregir un producto específico
UPDATE products 
SET line_id = (
  SELECT line_id FROM categories WHERE id = products.category_id
)
WHERE barcode = 'PAN-001-SN';  -- Reemplaza con el código del producto

-- 3. Actualizar su stock
UPDATE stock s
SET warehouse_id = 'Tienda Mujeres'  -- o 'Tienda Hombres'
FROM products p
WHERE s.product_id = p.id
  AND p.barcode = 'PAN-001-SN';
```

## Verificación Post-Corrección

Después de ejecutar la corrección, verifica:

### 1. No hay inconsistencias
```sql
SELECT COUNT(*) as inconsistencias
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.line_id != c.line_id;
```
Debe retornar: `0`

### 2. Cada tienda tiene solo sus líneas
```sql
SELECT 
  s.warehouse_id as tienda,
  l.name as linea,
  COUNT(*) as productos
FROM stock s
JOIN products p ON s.product_id = p.id
JOIN lines l ON p.line_id = l.id
GROUP BY s.warehouse_id, l.name
ORDER BY s.warehouse_id, l.name;
```

Resultado esperado:
```
tienda          | linea    | productos
----------------|----------|----------
Tienda Mujeres  | Mujeres  | X
Tienda Mujeres  | Niños    | Y (opcional)
Tienda Hombres  | Hombres  | Z
```

### 3. Verificar en la UI

1. Ve a: **Inventario → Stock**
2. Verifica que:
   - **Tienda Mujeres** solo tiene productos de línea "Mujeres" (y "Niños" si aplica)
   - **Tienda Hombres** solo tiene productos de línea "Hombres"

## Prevención Futura

Para evitar este problema al crear nuevos productos:

### 1. En el Código

Cuando crees un producto, asegúrate de que:
```typescript
// ❌ INCORRECTO
const product = {
  category_id: 'categoria-de-mujeres',
  line_id: 'linea-de-hombres',  // ❌ No coincide!
}

// ✅ CORRECTO
const product = {
  category_id: 'categoria-de-mujeres',
  line_id: 'linea-de-mujeres',  // ✅ Coincide con la línea de la categoría
}
```

### 2. Agregar Validación

Puedes agregar un constraint en la base de datos:

```sql
-- Agregar función de validación
CREATE OR REPLACE FUNCTION validate_product_line()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.line_id != (SELECT line_id FROM categories WHERE id = NEW.category_id) THEN
    RAISE EXCEPTION 'El line_id del producto debe coincidir con el line_id de su categoría';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Agregar trigger
CREATE TRIGGER check_product_line
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION validate_product_line();
```

## Resumen

1. ✅ Ejecuta `DIAGNOSTICO_LINEAS_TIENDAS.sql` para ver el problema
2. ✅ Ejecuta `FIX_LINEAS_PRODUCTOS.sql` para corregirlo
3. ✅ Verifica que todo esté correcto
4. ✅ Considera agregar validación para prevenir futuros problemas

## Notas

- Este problema NO afecta las ventas o movimientos existentes
- Solo afecta la visualización del stock por tienda
- La corrección es segura y reversible
- Todos los datos se mantienen, solo se corrigen las referencias
