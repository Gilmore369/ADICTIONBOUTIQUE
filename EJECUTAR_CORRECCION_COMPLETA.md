# 🚀 Ejecutar Corrección Completa

## Resumen

Este documento te guía para ejecutar **una sola vez** el script que corrige:
1. ✅ Nombres de tiendas (estandariza a "Tienda Mujeres" y "Tienda Hombres")
2. ✅ Líneas de productos (corrige productos con line_id incorrecto)

## ⚠️ Antes de Empezar

### Problemas que se van a corregir:

1. **Nombres inconsistentes de tiendas:**
   - `TIENDA_MUJERES`, `Mujeres`, `MUJERES` → `Tienda Mujeres`
   - `TIENDA_HOMBRES`, `Hombres`, `HOMBRES` → `Tienda Hombres`

2. **Productos con línea incorrecta:**
   - Productos que tienen `line_id` que no coincide con la línea de su categoría
   - Ejemplo: "Pantalón Jogger" con categoría de "Mujeres" pero line_id de "Hombres"

## 📋 Pasos para Ejecutar

### Paso 1: Diagnóstico (Opcional pero Recomendado)

Primero, ejecuta el diagnóstico para ver qué se va a corregir:

```bash
# Abre Supabase SQL Editor y ejecuta:
supabase/DIAGNOSTICO_LINEAS_TIENDAS.sql
```

Esto te mostrará:
- ✅ Líneas disponibles
- ✅ Categorías por línea
- ⚠️ Inconsistencias detectadas
- 📊 Resumen actual por tienda

### Paso 2: Ejecutar Corrección Completa

Ejecuta el script de corrección:

```bash
# Abre Supabase SQL Editor y ejecuta:
supabase/FIX_COMPLETO_TIENDAS_Y_LINEAS.sql
```

### Paso 3: Verificar Resultados

El script mostrará mensajes como:

```
╔════════════════════════════════════════════════════════════╗
║  CORRECCIÓN COMPLETA: TIENDAS Y LÍNEAS                    ║
╚════════════════════════════════════════════════════════════╝

📍 PARTE 1: Estandarizando nombres de tiendas...
✅ Nombres de tiendas estandarizados

📦 PARTE 2: Corrigiendo line_id de productos...
⚠️  Productos con line_id incorrecto: 9
✅ Line_id de productos corregido

🔍 VERIFICACIÓN FINAL:

📊 Stock por tienda:
   • Tienda Mujeres: 45 productos
   • Tienda Hombres: 47 productos

📋 Líneas por tienda:
   • Tienda Mujeres: 1 líneas diferentes
   • Tienda Hombres: 1 líneas diferentes

✅ ÉXITO: Todos los productos tienen line_id correcto

╔════════════════════════════════════════════════════════════╗
║  ✅ CORRECCIÓN COMPLETADA EXITOSAMENTE                    ║
╚════════════════════════════════════════════════════════════╝
```

Y una tabla final:

```
seccion                              | tienda          | linea    | modelos | variantes | stock_total
-------------------------------------|-----------------|----------|---------|-----------|------------
=== RESUMEN FINAL: LÍNEAS POR TIENDA | Tienda Mujeres  | Mujeres  | 5       | 45        | 450
=== RESUMEN FINAL: LÍNEAS POR TIENDA | Tienda Hombres  | Hombres  | 5       | 47        | 470
```

### Paso 4: Verificar en la Aplicación

1. **Reinicia la aplicación:**
   ```bash
   npm run dev
   ```

2. **Ve a Inventario → Stock:**
   - Deberías ver solo dos secciones:
     - **Tienda Mujeres** (con productos de línea "Mujeres")
     - **Tienda Hombres** (con productos de línea "Hombres")

3. **Verifica que no hay mezclas:**
   - NO deberías ver productos de "Hombres" en "Tienda Mujeres"
   - NO deberías ver productos de "Mujeres" en "Tienda Hombres"

## ✅ Verificación Manual (Opcional)

Si quieres verificar manualmente en la base de datos:

### Verificar nombres de tiendas:
```sql
SELECT DISTINCT warehouse_id FROM stock;
-- Debe mostrar solo: Tienda Mujeres, Tienda Hombres
```

### Verificar que no hay inconsistencias en líneas:
```sql
SELECT COUNT(*) as inconsistencias
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.line_id != c.line_id;
-- Debe retornar: 0
```

### Verificar líneas por tienda:
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
Tienda Mujeres  | Mujeres  | 45
Tienda Hombres  | Hombres  | 47
```

## 🎯 Resultado Esperado

### Antes (❌ Confuso):
```
Stock:
├── Mujeres (línea)
│   └── Casaca Denim
├── TIENDA_MUJERES (almacén)
│   └── Pantalón Denim Negro
└── Hombres (línea)
    └── Pantalón Jogger (❌ categoría de Mujeres!)
```

### Después (✅ Correcto):
```
Stock:
├── Tienda Mujeres
│   ├── Casaca Denim (línea: Mujeres)
│   ├── Pantalón Denim Negro (línea: Mujeres)
│   └── Pantalón Jogger (línea: Mujeres) ✅ Corregido!
└── Tienda Hombres
    ├── Polo Básico (línea: Hombres)
    └── Jean Recto (línea: Hombres)
```

## 📚 Archivos Relacionados

- `supabase/DIAGNOSTICO_LINEAS_TIENDAS.sql` - Para diagnosticar problemas
- `supabase/FIX_COMPLETO_TIENDAS_Y_LINEAS.sql` - Corrección completa (este)
- `supabase/FIX_WAREHOUSE_NAMES.sql` - Solo corrección de nombres de tiendas
- `supabase/FIX_LINEAS_PRODUCTOS.sql` - Solo corrección de líneas
- `VALIDAR_LINEAS_TIENDAS.md` - Documentación detallada

## 🆘 Solución de Problemas

### Problema: El script da error

**Solución:**
1. Verifica que no haya transacciones abiertas
2. Cierra todas las queries en Supabase SQL Editor
3. Ejecuta el script nuevamente

### Problema: Aún veo productos mezclados

**Solución:**
1. Ejecuta el diagnóstico: `DIAGNOSTICO_LINEAS_TIENDAS.sql`
2. Busca la sección "INCONSISTENCIAS DETECTADAS"
3. Si hay productos listados, ejecuta nuevamente: `FIX_COMPLETO_TIENDAS_Y_LINEAS.sql`

### Problema: Los cambios no se reflejan en la UI

**Solución:**
1. Limpia el caché del navegador (Ctrl + Shift + R)
2. Reinicia el servidor de desarrollo
3. Verifica que el script se ejecutó sin errores

## 📝 Notas Importantes

- ✅ El script usa transacciones (BEGIN/COMMIT)
- ✅ Si algo falla, todos los cambios se revierten automáticamente
- ✅ Es seguro ejecutar el script múltiples veces
- ✅ No se pierden datos, solo se corrigen referencias
- ✅ Las ventas y movimientos existentes no se afectan

## 🎉 Completado

Una vez ejecutado el script y verificado:
- ✅ Todas las tiendas tienen nombres consistentes
- ✅ Todos los productos tienen line_id correcto
- ✅ Cada tienda tiene solo productos de su línea correspondiente
- ✅ La UI muestra correctamente el stock por tienda

¡Tu sistema ahora está correctamente organizado! 🎊
