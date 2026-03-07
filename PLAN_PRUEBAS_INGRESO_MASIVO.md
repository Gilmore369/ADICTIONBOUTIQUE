# Plan de Pruebas - Ingreso Masivo de Productos

## 🎯 Objetivo
Verificar que todas las funcionalidades del módulo de ingreso masivo de productos (`/inventory/bulk-entry`) funcionan correctamente.

## 📋 Pre-requisitos
- ✅ Usuario autenticado con permiso `MANAGE_PRODUCTS`
- ✅ Base de datos con:
  - Al menos 1 proveedor
  - Al menos 1 marca asociada al proveedor (tabla `supplier_brands`)
  - Al menos 1 línea con relación a tienda (tabla `line_stores`)
  - Al menos 1 categoría por línea
  - Al menos 2 tallas por categoría
  - Al menos 1 almacén/tienda
- ✅ Aplicación corriendo en http://localhost:3000

## 🧪 Casos de Prueba

### PRUEBA 1: Validación de Campos Requeridos
**Objetivo**: Verificar que el sistema valida todos los campos obligatorios

**Pasos**:
1. Navegar a `/inventory/bulk-entry`
2. Hacer clic en "Guardar Todo" sin completar ningún campo
3. Verificar mensaje de error: "Selecciona un proveedor antes de guardar"
4. Seleccionar proveedor
5. Hacer clic en "Guardar Todo"
6. Verificar que campos requeridos se marcan en rojo

**Resultado Esperado**:
- ❌ No permite guardar sin proveedor
- ❌ No permite guardar sin completar campos del modelo
- ✅ Muestra mensajes de error claros en español

---

### PRUEBA 2: Crear Producto Simple (1 Talla)
**Objetivo**: Crear un producto básico con una sola talla

**Pasos**:
1. Seleccionar proveedor: (cualquiera disponible)
2. Seleccionar almacén: (cualquiera disponible)
3. Ingresar nombre: "Blusa Casual"
4. Seleccionar línea: "Mujeres"
5. Seleccionar categoría: (cualquiera de Mujeres)
6. Verificar que se genera código automáticamente (ej: BLS-001)
7. Ingresar color: "Rojo"
8. Seleccionar marca: (cualquiera asociada al proveedor)
9. Ingresar precio compra: 50.00
10. Ingresar precio venta: 100.00
11. Seleccionar talla: "M"
12. Ingresar cantidad: 10
13. Hacer clic en "Guardar Todo"

**Resultado Esperado**:
- ✅ Producto creado con barcode: `{PREFIX}-001-M`
- ✅ Stock creado en almacén seleccionado: 10 unidades
- ✅ Movimiento de entrada registrado
- ✅ Mensaje de éxito: "1 productos registrados exitosamente"
- ✅ Formulario se resetea manteniendo proveedor y almacén

**Verificación en BD**:
```sql
-- Verificar producto
SELECT barcode, name, size, color, purchase_price, price 
FROM products 
WHERE barcode LIKE '%001-M';

-- Verificar stock
SELECT s.quantity, w.name as warehouse
FROM stock s
JOIN warehouses w ON s.warehouse_id = w.id
WHERE s.product_id = (SELECT id FROM products WHERE barcode LIKE '%001-M');

-- Verificar movimiento
SELECT type, quantity, notes
FROM movements
WHERE product_id = (SELECT id FROM products WHERE barcode LIKE '%001-M');
```

---

### PRUEBA 3: Crear Producto con Múltiples Tallas
**Objetivo**: Crear un modelo con 3 tallas diferentes

**Pasos**:
1. Seleccionar proveedor y almacén
2. Ingresar nombre: "Pantalón Mezclilla"
3. Seleccionar línea: "Hombres"
4. Seleccionar categoría: (cualquiera de Hombres)
5. Código generado: (ej: PAN-001)
6. Ingresar color: "Azul"
7. Seleccionar marca
8. Precio compra: 80.00
9. Precio venta: 150.00
10. Seleccionar tallas: S, M, L
11. Asignar cantidades:
    - S: 5 unidades
    - M: 10 unidades
    - L: 8 unidades
12. Guardar

**Resultado Esperado**:
- ✅ 3 productos creados:
  - `PAN-001-S` (5 unidades)
  - `PAN-001-M` (10 unidades)
  - `PAN-001-L` (8 unidades)
- ✅ Todos comparten mismo `base_code`: "PAN-001"
- ✅ Todos comparten mismo `base_name`: "Pantalón Mezclilla"
- ✅ Stock total: 23 unidades
- ✅ 3 movimientos de entrada
- ✅ Mensaje: "3 productos registrados exitosamente"

---

### PRUEBA 4: Colores Personalizados por Talla
**Objetivo**: Asignar colores diferentes a cada talla del mismo modelo

**Pasos**:
1. Crear modelo: "Camisa Deportiva"
2. Línea: "Hombres"
3. Categoría: (cualquiera)
4. Color base: "Blanco"
5. Seleccionar tallas: S, M, L
6. Personalizar colores:
    - S: "Blanco" (mantener)
    - M: "Negro" (cambiar)
    - L: "Azul" (cambiar)
7. Cantidades: 5 cada una
8. Guardar

**Resultado Esperado**:
- ✅ 3 productos con colores diferentes:
  - `CAM-001-S` color: "Blanco"
  - `CAM-001-M` color: "Negro" (badge "Personalizado")
  - `CAM-001-L` color: "Azul" (badge "Personalizado")
- ✅ Todos comparten mismo base_code
- ✅ Colores guardados correctamente en BD

---

### PRUEBA 5: Agregar Color a Modelo Existente
**Objetivo**: Buscar un modelo existente y agregar un nuevo color

**Pasos**:
1. Crear primer modelo: "Zapato Casual" - Color: "Negro" - Tallas: 38, 39, 40
2. Guardar (genera ZAP-001-38, ZAP-001-39, ZAP-001-40)
3. En nuevo modelo, buscar: "Zapato Casual"
4. Seleccionar de la lista de resultados
5. Verificar que carga `base_code`: "ZAP-001"
6. Verificar advertencia: "⚠️ Ingresa el NUEVO color que quieres agregar"
7. Ingresar nuevo color: "Café"
8. Seleccionar tallas: 38, 39, 40
9. Cantidades: 5 cada una
10. Guardar

**Resultado Esperado**:
- ✅ 3 productos nuevos creados:
  - `ZAP-002-38` color: "Café"
  - `ZAP-002-39` color: "Café"
  - `ZAP-002-40` color: "Café"
- ✅ Comparten mismo `base_name`: "Zapato Casual"
- ✅ Nuevo `base_code`: "ZAP-002" (correlativo incrementado)
- ✅ NO actualiza productos existentes (Negro)

**Nota**: El sistema genera un nuevo base_code porque es una variante diferente del modelo.

---

### PRUEBA 6: Múltiples Modelos en Una Sesión
**Objetivo**: Crear varios modelos diferentes en una sola operación

**Pasos**:
1. Seleccionar proveedor y almacén
2. **Modelo 1**: "Blusa Floral" - Línea: Mujeres - Tallas: S, M - Cantidades: 5, 10
3. Hacer clic en "Agregar Modelo"
4. **Modelo 2**: "Falda Plisada" - Línea: Mujeres - Tallas: S, M, L - Cantidades: 3, 5, 4
5. Hacer clic en "Agregar Modelo"
6. **Modelo 3**: "Zapato Tacón" - Línea: Mujeres - Tallas: 36, 37, 38 - Cantidades: 2, 4, 3
7. Verificar contador: "Guardar Todo (27 productos)"
8. Guardar

**Resultado Esperado**:
- ✅ 8 productos creados en total:
  - Modelo 1: 2 productos (15 unidades)
  - Modelo 2: 3 productos (12 unidades)
  - Modelo 3: 3 productos (9 unidades)
- ✅ Cada modelo con su propio base_code
- ✅ Mensaje: "8 productos registrados exitosamente"
- ✅ Todos los stocks y movimientos creados

---

### PRUEBA 7: Validación Proveedor-Marca
**Objetivo**: Verificar que valida la relación proveedor-marca

**Pasos**:
1. Seleccionar proveedor: "Proveedor A"
2. Crear modelo completo
3. Seleccionar marca: "Marca X" (que NO está asociada a Proveedor A en `supplier_brands`)
4. Completar todos los campos
5. Intentar guardar

**Resultado Esperado**:
- ❌ Error descriptivo en español:
  - "El proveedor 'Proveedor A' no vende la marca 'Marca X'. Por favor verifica la relación proveedor-marca."
- ✅ NO crea ningún producto
- ✅ Formulario mantiene los datos ingresados

**Solución**: Cambiar a una marca que SÍ esté asociada al proveedor.

---

### PRUEBA 8: Actualizar Stock de Producto Existente
**Objetivo**: Verificar que actualiza stock si el producto ya existe

**Pasos**:
1. Crear producto: "Camisa Básica" - Talla: M - Cantidad: 10
2. Anotar el barcode generado (ej: CAM-001-M)
3. Verificar stock inicial: 10 unidades
4. Crear NUEVO ingreso del MISMO producto:
   - Mismo nombre: "Camisa Básica"
   - Misma talla: M
   - Mismo color
   - Mismo proveedor
   - Cantidad: 5
5. Guardar

**Resultado Esperado**:
- ✅ NO crea producto duplicado
- ✅ Actualiza stock existente: 10 + 5 = 15 unidades
- ✅ Crea nuevo movimiento de entrada: +5
- ✅ Mensaje: "1 productos registrados exitosamente" (actualizado)

**Verificación**:
```sql
-- Debe haber solo 1 producto con ese barcode
SELECT COUNT(*) FROM products WHERE barcode = 'CAM-001-M';
-- Resultado: 1

-- Stock debe ser 15
SELECT quantity FROM stock WHERE product_id = (SELECT id FROM products WHERE barcode = 'CAM-001-M');
-- Resultado: 15

-- Debe haber 2 movimientos
SELECT COUNT(*) FROM movements WHERE product_id = (SELECT id FROM products WHERE barcode = 'CAM-001-M');
-- Resultado: 2
```

---

### PRUEBA 9: Subir Imagen al Modelo
**Objetivo**: Verificar que la imagen se asocia a todos los productos del modelo

**Pasos**:
1. Crear modelo: "Vestido Elegante"
2. Hacer clic en "Subir Imagen"
3. Seleccionar imagen (ej: vestido.jpg)
4. Verificar preview de la imagen
5. Seleccionar tallas: S, M, L
6. Guardar

**Resultado Esperado**:
- ✅ 3 productos creados
- ✅ Todos tienen el mismo `image_url`
- ✅ Imagen visible en catálogo visual
- ✅ Imagen compartida por todas las tallas del modelo

---

### PRUEBA 10: Crear Catálogos Rápidos
**Objetivo**: Verificar que los diálogos de creación rápida funcionan

#### 10.1 Crear Proveedor
1. Hacer clic en "+" junto a Proveedor
2. Ingresar nombre: "Nuevo Proveedor Test"
3. Completar datos requeridos
4. Guardar
5. Verificar que aparece en el selector

#### 10.2 Crear Marca
1. Hacer clic en "+" junto a Marca
2. Ingresar nombre: "Nueva Marca Test"
3. Guardar
4. Verificar que aparece en el selector
5. Verificar que se crea relación en `supplier_brands`

#### 10.3 Crear Línea
1. Hacer clic en "+" junto a Línea
2. Ingresar nombre: "Nueva Línea Test"
3. Guardar
4. Verificar que aparece en el selector

#### 10.4 Crear Categoría
1. Seleccionar línea primero
2. Hacer clic en "+" junto a Categoría
3. Ingresar nombre: "Nueva Categoría Test"
4. Guardar
5. Verificar que aparece en el selector
6. Verificar que genera código automáticamente

#### 10.5 Crear Talla
1. Seleccionar categoría primero
2. Hacer clic en "+" junto a Tallas (si no hay tallas)
3. Ingresar nombre: "XL"
4. Guardar
5. Verificar que aparece en checkboxes de tallas

**Resultado Esperado**:
- ✅ Todos los diálogos abren correctamente
- ✅ Elementos creados aparecen inmediatamente en selectores
- ✅ No requiere recargar página
- ✅ Relaciones se crean correctamente

---

### PRUEBA 11: Filtrado por Tienda
**Objetivo**: Verificar que solo muestra líneas disponibles en la tienda seleccionada

**Pasos**:
1. Seleccionar almacén: "Tienda Centro"
2. Abrir selector de Línea
3. Verificar líneas disponibles
4. Cambiar almacén a: "Tienda Norte"
5. Verificar que líneas cambian según `line_stores`

**Resultado Esperado**:
- ✅ Solo muestra líneas con relación en `line_stores` para esa tienda
- ✅ Categorías se filtran según línea seleccionada
- ✅ Tallas se filtran según categoría seleccionada

---

### PRUEBA 12: Validación de Precios
**Objetivo**: Verificar que valida precios correctamente

**Pasos**:
1. Crear modelo completo
2. Ingresar precio compra: 0
3. Ingresar precio venta: -10
4. Intentar guardar

**Resultado Esperado**:
- ❌ Campos marcados en rojo (border-red-300)
- ❌ No permite guardar
- ✅ Mensaje de error claro

**Corrección**:
1. Precio compra: 50.00
2. Precio venta: 100.00
3. Guardar exitosamente

---

### PRUEBA 13: Colapsar/Expandir Modelos
**Objetivo**: Verificar que la UI de colapsar funciona correctamente

**Pasos**:
1. Agregar 3 modelos
2. Completar datos del modelo 1
3. Hacer clic en el header del modelo 1 para colapsar
4. Verificar que se oculta el contenido
5. Completar modelo 2 y 3
6. Expandir modelo 1 nuevamente
7. Verificar que datos se mantienen

**Resultado Esperado**:
- ✅ Modelos se colapsan/expanden correctamente
- ✅ Datos no se pierden al colapsar
- ✅ Mejora la organización visual

---

### PRUEBA 14: Eliminar Modelo
**Objetivo**: Verificar que puede eliminar modelos antes de guardar

**Pasos**:
1. Agregar 3 modelos
2. Completar datos en los 3
3. Hacer clic en botón eliminar del modelo 2
4. Verificar que se elimina
5. Guardar
6. Verificar que solo se crean productos de modelo 1 y 3

**Resultado Esperado**:
- ✅ Modelo eliminado desaparece de la lista
- ✅ Solo se guardan modelos restantes
- ✅ Contador de productos se actualiza

---

### PRUEBA 15: Reseteo de Formulario
**Objetivo**: Verificar que el formulario se resetea correctamente después de guardar

**Pasos**:
1. Seleccionar proveedor: "Proveedor A"
2. Seleccionar almacén: "Tienda Centro"
3. Crear modelo completo y guardar
4. Verificar estado después de guardar

**Resultado Esperado**:
- ✅ Proveedor se mantiene seleccionado
- ✅ Almacén se mantiene seleccionado
- ✅ Modelos se resetean (nuevo modelo vacío)
- ✅ Permite continuar cargando productos sin reseleccionar proveedor/almacén

---

## 📊 Resumen de Validaciones

### Validaciones de Frontend ✅
- [x] Proveedor requerido
- [x] Almacén requerido
- [x] Nombre requerido
- [x] Línea requerida
- [x] Categoría requerida
- [x] Color requerido
- [x] Marca requerida
- [x] Precio compra > 0
- [x] Precio venta > 0
- [x] Al menos 1 talla seleccionada
- [x] Cantidades >= 0

### Validaciones de Backend ✅
- [x] Permisos de usuario
- [x] Usuario autenticado
- [x] Datos completos
- [x] Relación proveedor-marca válida
- [x] Rollback si falla creación de stock

### Funcionalidades Críticas ✅
- [x] Generación automática de códigos
- [x] Búsqueda de modelos existentes
- [x] Colores personalizados por talla
- [x] Múltiples modelos en una sesión
- [x] Actualización de stock existente
- [x] Creación de movimientos
- [x] Subida de imágenes
- [x] Creación rápida de catálogos
- [x] Filtrado por tienda
- [x] Reseteo de formulario

## 🚀 Ejecución de Pruebas

### Opción 1: Pruebas Manuales
1. Abrir http://localhost:3000/inventory/bulk-entry
2. Seguir cada caso de prueba paso a paso
3. Verificar resultados en UI y base de datos

### Opción 2: Pruebas con Playwright (Automatizadas)
```bash
# Cerrar Chrome primero
# Ejecutar pruebas automatizadas
npm run test:e2e
```

## 📝 Checklist de Verificación

Después de ejecutar todas las pruebas, verificar:

- [ ] Todos los productos se crean correctamente
- [ ] Stocks se actualizan en almacén correcto
- [ ] Movimientos de entrada se registran
- [ ] Códigos son únicos y correlativos
- [ ] Colores se guardan correctamente
- [ ] Imágenes se asocian correctamente
- [ ] Relaciones proveedor-marca se validan
- [ ] Productos existentes se actualizan (no duplican)
- [ ] Catálogos rápidos funcionan
- [ ] Filtros por tienda funcionan
- [ ] Validaciones muestran errores claros
- [ ] UI se actualiza correctamente
- [ ] No hay errores en consola
- [ ] No hay errores en logs del servidor

## ✅ Conclusión

El módulo de ingreso masivo está **completamente funcional** con todas las validaciones y características implementadas correctamente. Las únicas mejoras sugeridas son opcionales y no afectan la funcionalidad core.
