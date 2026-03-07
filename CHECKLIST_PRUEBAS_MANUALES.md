# ✅ Checklist de Pruebas Manuales - Ingreso Masivo

## 📋 Instrucciones
- Marca cada item con ✅ cuando lo hayas probado exitosamente
- Si encuentras un error, márcalo con ❌ y anota el problema
- Ejecuta las pruebas en orden

## 🚀 Pre-requisitos

- [ ] Aplicación corriendo en http://localhost:3000
- [ ] Usuario autenticado con permiso `MANAGE_PRODUCTS`
- [ ] Base de datos con datos de prueba:
  - [ ] Al menos 1 proveedor
  - [ ] Al menos 1 marca asociada al proveedor
  - [ ] Al menos 1 línea con relación a tienda
  - [ ] Al menos 1 categoría por línea
  - [ ] Al menos 2 tallas por categoría
  - [ ] Al menos 1 almacén/tienda

## 1️⃣ Validaciones Básicas

### 1.1 Validación de Proveedor
- [ ] Abrir `/inventory/bulk-entry`
- [ ] Hacer clic en "Guardar Todo" sin seleccionar proveedor
- [ ] ✅ Debe mostrar: "Selecciona un proveedor antes de guardar"

### 1.2 Validación de Campos Requeridos
- [ ] Seleccionar proveedor
- [ ] Hacer clic en "Guardar Todo" sin completar modelo
- [ ] ✅ Campos requeridos deben marcarse en rojo
- [ ] ✅ Debe mostrar mensaje de error

### 1.3 Validación de Precios
- [ ] Ingresar precio compra: 0
- [ ] Ingresar precio venta: -10
- [ ] ✅ Campos deben marcarse en rojo
- [ ] ✅ No debe permitir guardar

### 1.4 Validación de Tallas
- [ ] Completar todos los campos excepto tallas
- [ ] Intentar guardar
- [ ] ✅ Debe mostrar: "Debes seleccionar al menos una talla"

## 2️⃣ Creación de Productos

### 2.1 Producto Simple (1 talla)
- [ ] Seleccionar proveedor: _______________
- [ ] Seleccionar almacén: _______________
- [ ] Ingresar nombre: "Test Blusa Simple"
- [ ] Seleccionar línea: _______________
- [ ] Seleccionar categoría: _______________
- [ ] ✅ Verificar que se genera código automático: _______________
- [ ] Ingresar color: "Rojo"
- [ ] Seleccionar marca: _______________
- [ ] Precio compra: 50.00
- [ ] Precio venta: 100.00
- [ ] Seleccionar talla: M
- [ ] Cantidad: 10
- [ ] Hacer clic en "Guardar Todo"
- [ ] ✅ Mensaje de éxito: "1 productos registrados exitosamente"
- [ ] ✅ Formulario se resetea manteniendo proveedor y almacén

**Verificación en BD:**
```sql
SELECT barcode, name, size, color, purchase_price, price 
FROM products 
WHERE name LIKE '%Test Blusa Simple%';
```
- [ ] ✅ Producto creado con barcode correcto
- [ ] ✅ Stock creado: 10 unidades
- [ ] ✅ Movimiento de entrada registrado

### 2.2 Producto con Múltiples Tallas
- [ ] Crear modelo: "Test Pantalón Multi"
- [ ] Seleccionar 3 tallas: S, M, L
- [ ] Cantidades: S=5, M=10, L=8
- [ ] Guardar
- [ ] ✅ Mensaje: "3 productos registrados exitosamente"

**Verificación:**
- [ ] ✅ 3 productos creados (uno por talla)
- [ ] ✅ Todos comparten mismo base_code
- [ ] ✅ Stock total: 23 unidades
- [ ] ✅ 3 movimientos de entrada

### 2.3 Colores Personalizados por Talla
- [ ] Crear modelo: "Test Camisa Colores"
- [ ] Color base: "Blanco"
- [ ] Seleccionar tallas: S, M, L
- [ ] Personalizar colores:
  - [ ] S: Blanco (mantener)
  - [ ] M: Negro (cambiar)
  - [ ] L: Azul (cambiar)
- [ ] ✅ Verificar badge "Personalizado" en M y L
- [ ] Cantidades: 5 cada una
- [ ] Guardar

**Verificación:**
- [ ] ✅ 3 productos con colores diferentes
- [ ] ✅ Colores guardados correctamente en BD

### 2.4 Múltiples Modelos en Una Sesión
- [ ] Crear Modelo 1: "Test Blusa A" (2 tallas)
- [ ] Hacer clic en "Agregar Modelo"
- [ ] Crear Modelo 2: "Test Falda B" (3 tallas)
- [ ] Hacer clic en "Agregar Modelo"
- [ ] Crear Modelo 3: "Test Zapato C" (2 tallas)
- [ ] ✅ Verificar contador: "Guardar Todo (X productos)"
- [ ] Guardar

**Verificación:**
- [ ] ✅ Todos los productos creados
- [ ] ✅ Cada modelo con su propio base_code
- [ ] ✅ Stocks y movimientos correctos

## 3️⃣ Funcionalidades Avanzadas

### 3.1 Búsqueda de Modelo Existente
- [ ] Crear primer modelo: "Test Zapato Original" - Color: Negro
- [ ] Guardar (anotar base_code: _______________)
- [ ] En nuevo modelo, buscar: "Test Zapato Original"
- [ ] Seleccionar de resultados
- [ ] ✅ Verificar que carga base_code
- [ ] ✅ Verificar advertencia: "Ingresa el NUEVO color"
- [ ] Ingresar nuevo color: "Café"
- [ ] Seleccionar tallas y guardar

**Verificación:**
- [ ] ✅ Nuevos productos creados con nuevo base_code
- [ ] ✅ Productos originales (Negro) no se modifican

### 3.2 Actualizar Stock de Producto Existente
- [ ] Crear producto: "Test Actualizar Stock" - Talla M - Cantidad: 10
- [ ] Anotar barcode: _______________
- [ ] Verificar stock inicial: 10 unidades
- [ ] Crear NUEVO ingreso del MISMO producto:
  - [ ] Mismo nombre, talla, color, proveedor
  - [ ] Cantidad: 5
- [ ] Guardar

**Verificación:**
```sql
-- Debe haber solo 1 producto
SELECT COUNT(*) FROM products WHERE barcode = 'BARCODE_ANOTADO';

-- Stock debe ser 15
SELECT quantity FROM stock 
WHERE product_id = (SELECT id FROM products WHERE barcode = 'BARCODE_ANOTADO');

-- Debe haber 2 movimientos
SELECT COUNT(*) FROM movements 
WHERE product_id = (SELECT id FROM products WHERE barcode = 'BARCODE_ANOTADO');
```
- [ ] ✅ NO duplicó producto
- [ ] ✅ Stock actualizado: 15 unidades
- [ ] ✅ 2 movimientos registrados

### 3.3 Subir Imagen
- [ ] Crear modelo: "Test Con Imagen"
- [ ] Hacer clic en "Subir Imagen"
- [ ] Seleccionar imagen de prueba
- [ ] ✅ Verificar preview de imagen
- [ ] Seleccionar 2 tallas
- [ ] Guardar

**Verificación:**
- [ ] ✅ 2 productos creados
- [ ] ✅ Ambos tienen mismo image_url
- [ ] ✅ Imagen visible en catálogo visual

## 4️⃣ Creación Rápida de Catálogos

### 4.1 Crear Proveedor
- [ ] Hacer clic en "+" junto a Proveedor
- [ ] Ingresar nombre: "Test Proveedor Rápido"
- [ ] Completar datos requeridos
- [ ] Guardar
- [ ] ✅ Aparece en selector de proveedor

### 4.2 Crear Marca
- [ ] Hacer clic en "+" junto a Marca
- [ ] Ingresar nombre: "Test Marca Rápida"
- [ ] Guardar
- [ ] ✅ Aparece en selector de marca

**Verificación:**
```sql
-- Debe existir relación proveedor-marca
SELECT * FROM supplier_brands 
WHERE supplier_id = (SELECT id FROM suppliers WHERE name = 'Test Proveedor Rápido')
AND brand_id = (SELECT id FROM brands WHERE name = 'Test Marca Rápida');
```
- [ ] ✅ Relación creada automáticamente

### 4.3 Crear Línea
- [ ] Hacer clic en "+" junto a Línea
- [ ] Ingresar nombre: "Test Línea Rápida"
- [ ] Guardar
- [ ] ✅ Aparece en selector de línea

### 4.4 Crear Categoría
- [ ] Seleccionar línea primero
- [ ] Hacer clic en "+" junto a Categoría
- [ ] Ingresar nombre: "Test Categoría Rápida"
- [ ] Guardar
- [ ] ✅ Aparece en selector de categoría
- [ ] ✅ Genera código automáticamente

### 4.5 Crear Talla
- [ ] Seleccionar categoría sin tallas
- [ ] Hacer clic en "Crear Tallas"
- [ ] Ingresar nombre: "XXL"
- [ ] Guardar
- [ ] ✅ Aparece en checkboxes de tallas

## 5️⃣ Validaciones Especiales

### 5.1 Validación Proveedor-Marca
**Pre-requisito:** Tener un proveedor que NO venda cierta marca

- [ ] Seleccionar proveedor: _______________
- [ ] Crear modelo completo
- [ ] Seleccionar marca que NO venda ese proveedor: _______________
- [ ] Intentar guardar
- [ ] ✅ Error: "El proveedor 'X' no vende la marca 'Y'"
- [ ] ✅ NO crea productos
- [ ] ✅ Formulario mantiene datos
- [ ] Cambiar a marca válida
- [ ] ✅ Guardar exitosamente

### 5.2 Filtrado por Tienda
- [ ] Seleccionar almacén: "Tienda A"
- [ ] Abrir selector de Línea
- [ ] Anotar líneas disponibles: _______________
- [ ] Cambiar almacén a: "Tienda B"
- [ ] Abrir selector de Línea
- [ ] ✅ Verificar que líneas cambian según line_stores

## 6️⃣ Interfaz de Usuario

### 6.1 Colapsar/Expandir Modelos
- [ ] Agregar 3 modelos
- [ ] Completar datos del modelo 1
- [ ] Hacer clic en header del modelo 1
- [ ] ✅ Modelo se colapsa
- [ ] Completar modelos 2 y 3
- [ ] Expandir modelo 1
- [ ] ✅ Datos se mantienen

### 6.2 Eliminar Modelo
- [ ] Agregar 3 modelos
- [ ] Completar datos en los 3
- [ ] Hacer clic en botón eliminar del modelo 2
- [ ] ✅ Modelo 2 desaparece
- [ ] ✅ Contador de productos se actualiza
- [ ] Guardar
- [ ] ✅ Solo se crean productos de modelo 1 y 3

### 6.3 Contador de Productos
- [ ] Crear modelo con 3 tallas: 5, 10, 8 unidades
- [ ] ✅ Contador muestra: "Guardar Todo (23 productos)"
- [ ] Agregar otro modelo con 2 tallas: 5, 5 unidades
- [ ] ✅ Contador actualiza: "Guardar Todo (33 productos)"

### 6.4 Reseteo de Formulario
- [ ] Seleccionar proveedor: _______________
- [ ] Seleccionar almacén: _______________
- [ ] Crear y guardar modelo
- [ ] ✅ Proveedor se mantiene seleccionado
- [ ] ✅ Almacén se mantiene seleccionado
- [ ] ✅ Modelos se resetean (nuevo modelo vacío)

## 7️⃣ Generación de Códigos

### 7.1 Código Automático
- [ ] Seleccionar categoría: _______________
- [ ] ✅ Código se genera automáticamente
- [ ] Anotar código: _______________
- [ ] Cambiar a otra categoría
- [ ] ✅ Código se regenera
- [ ] Volver a categoría original
- [ ] ✅ Código se mantiene correlativo

### 7.2 Formato de Barcode
- [ ] Crear producto con código: BLS-001
- [ ] Seleccionar tallas: S, M, L
- [ ] Guardar

**Verificación:**
- [ ] ✅ Barcodes generados:
  - [ ] BLS-001-S
  - [ ] BLS-001-M
  - [ ] BLS-001-L

## 8️⃣ Casos Extremos

### 8.1 Sin Tallas en Categoría
- [ ] Seleccionar categoría sin tallas configuradas
- [ ] ✅ Mensaje: "Esta categoría no tiene tallas configuradas"
- [ ] ✅ Botón "Crear Tallas" visible
- [ ] Hacer clic en "Crear Tallas"
- [ ] ✅ Diálogo de creación se abre

### 8.2 Cantidades en Cero
- [ ] Crear modelo completo
- [ ] Seleccionar 3 tallas
- [ ] Dejar todas las cantidades en 0
- [ ] Intentar guardar
- [ ] ✅ No crea productos (filtro de cantidad > 0)

### 8.3 Modelo Sin Completar
- [ ] Agregar 2 modelos
- [ ] Completar solo modelo 1
- [ ] Dejar modelo 2 incompleto
- [ ] Guardar
- [ ] ✅ Solo crea productos del modelo 1
- [ ] ✅ Ignora modelo 2 incompleto

## 📊 Resumen de Resultados

### Funcionalidades Probadas
- [ ] Validaciones básicas (4/4)
- [ ] Creación de productos (4/4)
- [ ] Funcionalidades avanzadas (3/3)
- [ ] Creación rápida (5/5)
- [ ] Validaciones especiales (2/2)
- [ ] Interfaz de usuario (4/4)
- [ ] Generación de códigos (2/2)
- [ ] Casos extremos (3/3)

### Total: _____ / 27 pruebas completadas

## ❌ Problemas Encontrados

| # | Prueba | Problema | Severidad |
|---|--------|----------|-----------|
| 1 |        |          | Alta/Media/Baja |
| 2 |        |          | Alta/Media/Baja |
| 3 |        |          | Alta/Media/Baja |

## ✅ Conclusión

- [ ] Todas las pruebas pasaron exitosamente
- [ ] Se encontraron problemas menores (documentados arriba)
- [ ] Se encontraron problemas críticos (requieren corrección)

**Fecha de prueba:** _______________
**Probado por:** _______________
**Versión:** _______________

## 📝 Notas Adicionales

```
Espacio para notas, observaciones o comentarios adicionales:






```

## 🚀 Siguiente Paso

Una vez completado este checklist:
1. Revisar problemas encontrados
2. Priorizar correcciones si las hay
3. Documentar casos de uso exitosos
4. Capacitar usuarios finales
