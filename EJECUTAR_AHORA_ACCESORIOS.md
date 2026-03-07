# ⚡ EJECUTAR AHORA: Completar Catálogo de Accesorios

**Fecha**: 04/03/2026  
**Prioridad**: 🔴 ALTA

---

## 📋 Scripts a Ejecutar en Supabase

### 1. Crear Categorías de Accesorios

**Archivo**: `supabase/CREATE_ACCESORIOS_CATEGORIES.sql`

**Qué hace**:
- Crea 4 categorías para la línea "Accesorios":
  - Bolsos
  - Cinturones
  - Gorros
  - Bufandas

**Cómo ejecutar**:
1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Copia y pega el contenido de `CREATE_ACCESORIOS_CATEGORIES.sql`
4. Ejecuta el script
5. Verifica que aparezca: "Categorías de Accesorios creadas exitosamente"

---

### 2. Crear Tallas para Accesorios

**Archivo**: `supabase/CREATE_ACCESORIOS_SIZES.sql`

**Qué hace**:
- Crea tallas específicas para cada categoría de accesorios:
  - **Bolsos**: Pequeño, Mediano, Grande, Único
  - **Cinturones**: 80cm, 85cm, 90cm, 95cm, 100cm, 105cm, 110cm, Único
  - **Gorros**: Único, S, M, L
  - **Bufandas**: Único, Corta, Larga

**Cómo ejecutar**:
1. En Supabase SQL Editor
2. Copia y pega el contenido de `CREATE_ACCESORIOS_SIZES.sql`
3. Ejecuta el script
4. Verifica que aparezca: "Todas las tallas de Accesorios creadas exitosamente"

---

## ✅ Validación Post-Ejecución

### 1. Verificar Categorías

```sql
SELECT 
  c.name as categoria,
  l.name as linea,
  c.description,
  c.active
FROM categories c
JOIN lines l ON c.line_id = l.id
WHERE l.name = 'Accesorios'
ORDER BY c.name;
```

**Resultado esperado**: 4 categorías activas

---

### 2. Verificar Tallas

```sql
SELECT 
  c.name as categoria,
  COUNT(s.id) as total_tallas
FROM categories c
LEFT JOIN sizes s ON c.category_id = s.id
JOIN lines l ON c.line_id = l.id
WHERE l.name = 'Accesorios'
GROUP BY c.name
ORDER BY c.name;
```

**Resultado esperado**:
- Bolsos: 4 tallas
- Bufandas: 3 tallas
- Cinturones: 8 tallas
- Gorros: 4 tallas

---

## 🧪 Pruebas en la Aplicación

### Prueba 1: Verificar en Categorías

1. Ir a http://localhost:3000/catalogs/categories
2. Filtrar por línea "Accesorios"
3. Verificar que aparecen las 4 categorías nuevas

### Prueba 2: Verificar en Tallas

1. Ir a http://localhost:3000/catalogs/sizes
2. Filtrar por línea "Accesorios"
3. Verificar que aparecen todas las tallas creadas

### Prueba 3: Ingreso Masivo con Accesorios

1. Ir a http://localhost:3000/inventory/bulk-entry
2. Seleccionar proveedor "Multimarca"
3. Crear un modelo:
   - Línea: Accesorios
   - Categoría: Bolsos
   - Nombre: "Bolso Casual Negro"
   - Marca: "Adidas"
   - Color: Negro
   - Precio Compra: 30.00
   - Precio Venta: 59.90
4. Seleccionar tallas: Mediano, Grande
5. Asignar cantidades: 5 y 3
6. Guardar
7. Verificar que se crean 2 productos

---

## 🎯 Cambios Realizados en el Código

### 1. Ingreso Masivo - Auto-selección de Tienda

**Archivo**: `components/inventory/bulk-product-entry-v2.tsx`

**Cambios**:
- ✅ El selector "Tienda Destino" ahora se auto-selecciona según el filtro de tienda activo
- ✅ Se bloquea (disabled) cuando hay un filtro de tienda activo
- ✅ Muestra mensaje: "🔒 Bloqueado por filtro de tienda: [Nombre Tienda]"

**Comportamiento**:
- Si filtro = "Tienda Hombres" → Auto-selecciona "Tienda Hombres" y bloquea
- Si filtro = "Tienda Mujeres" → Auto-selecciona "Tienda Mujeres" y bloquea
- Si filtro = "Todas las Tiendas" → Permite seleccionar manualmente

---

## 📸 Validación con Playwright

### Test 1: Filtro de Tienda en Ingreso Masivo

```javascript
// Navegar a ingreso masivo
await page.goto('http://localhost:3000/inventory/bulk-entry')

// Verificar que el selector de tienda está bloqueado
const warehouseSelect = page.locator('select').filter({ hasText: /Tienda/ })
const isDisabled = await warehouseSelect.isDisabled()
expect(isDisabled).toBe(true) // Debe estar bloqueado si hay filtro activo

// Verificar mensaje de bloqueo
const lockMessage = await page.locator('text=🔒 Bloqueado por filtro de tienda').textContent()
expect(lockMessage).toContain('Tienda Hombres') // O 'Tienda Mujeres' según filtro
```

### Test 2: Crear Producto de Accesorios

```javascript
// Seleccionar proveedor
await page.selectOption('select', { label: 'Multimarca' })

// Seleccionar línea Accesorios
await page.selectOption('select', { label: 'Accesorios' })

// Seleccionar categoría Bolsos
await page.selectOption('select', { label: 'Bolsos' })

// Verificar que aparecen las tallas
const sizes = await page.locator('label').filter({ hasText: /Pequeño|Mediano|Grande|Único/ }).count()
expect(sizes).toBe(4)
```

---

## 🎉 Resultado Final Esperado

Después de ejecutar los scripts y validar:

### Catálogos Completos:
- ✅ 5 líneas activas
- ✅ 17 categorías activas (13 anteriores + 4 nuevas de Accesorios)
- ✅ 90+ tallas activas (71 anteriores + ~19 nuevas de Accesorios)
- ✅ 5 proveedores activos
- ✅ 8 marcas activas

### Sistema de Filtro:
- ✅ Selector de tienda funcional
- ✅ Filtrado de líneas por tienda
- ✅ Filtrado de categorías por líneas
- ✅ Auto-selección y bloqueo en ingreso masivo

### Ingreso Masivo:
- ✅ Puede crear productos de todas las líneas
- ✅ Respeta el filtro de tienda activo
- ✅ Bloquea selector de tienda cuando hay filtro
- ✅ Permite crear productos de Accesorios

---

## 📝 Notas Importantes

1. **Orden de ejecución**: Primero categorías, luego tallas
2. **Validación**: Siempre verificar con las consultas SQL antes de probar en la app
3. **Filtro de tienda**: Accesorios aparece en AMBAS tiendas (Hombres y Mujeres)
4. **Tallas únicas**: Muchos accesorios usan talla "Único" para simplificar inventario

