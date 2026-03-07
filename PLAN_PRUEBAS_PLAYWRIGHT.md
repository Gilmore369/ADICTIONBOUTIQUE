# Plan de Pruebas con Playwright

## Objetivo
Validar que todas las funcionalidades de catálogos y creación masiva de productos funcionen correctamente en http://localhost:3000

## Estado Actual
✅ Código revisado y validado
✅ Servidor MCP de Playwright configurado
🔄 Esperando reconexión del servidor MCP

## Pruebas a Realizar

### 1. Navegación Inicial
- [ ] Abrir http://localhost:3000
- [ ] Verificar que la sesión esté iniciada
- [ ] Navegar al menú de Catálogos

### 2. Proveedores (Suppliers)
**URL**: http://localhost:3000/catalogs/suppliers

- [ ] Verificar que la página cargue correctamente
- [ ] Crear nuevo proveedor:
  - Nombre: "Proveedor Test 1"
  - Contacto: "Juan Pérez"
  - Teléfono: "555-1234"
  - Email: "test@proveedor.com"
- [ ] Verificar que aparezca en la lista
- [ ] Editar el proveedor creado
- [ ] Verificar que los cambios se guarden

### 3. Líneas (Lines)
**URL**: http://localhost:3000/catalogs/lines

- [ ] Verificar que la página cargue correctamente
- [ ] Crear nuevas líneas:
  - "Damas"
  - "Caballeros"
  - "Niños"
- [ ] Verificar que aparezcan en la lista
- [ ] Intentar crear línea sin nombre (debe fallar)

### 4. Marcas (Brands)
**URL**: http://localhost:3000/catalogs/brands

- [ ] Verificar que la página cargue correctamente
- [ ] Crear nueva marca:
  - Nombre: "Nike Test"
  - Seleccionar proveedor creado anteriormente
- [ ] Verificar que aparezca en la lista con el proveedor asociado
- [ ] Intentar crear marca sin seleccionar proveedor (debe mostrar error)
- [ ] Crear marca con múltiples proveedores

### 5. Categorías (Categories)
**URL**: http://localhost:3000/catalogs/categories

- [ ] Verificar que la página cargue correctamente
- [ ] Verificar que el selector de líneas muestre las líneas creadas
- [ ] Crear nuevas categorías:
  - Nombre: "Zapatos", Línea: "Damas"
  - Nombre: "Camisas", Línea: "Caballeros"
  - Nombre: "Pantalones", Línea: "Damas"
- [ ] Verificar que aparezcan en la lista con su línea asociada
- [ ] Intentar crear categoría sin seleccionar línea (debe fallar)

### 6. Tallas (Sizes)
**URL**: http://localhost:3000/catalogs/sizes

- [ ] Verificar que la página cargue correctamente
- [ ] Verificar que el selector de categorías muestre las categorías creadas
- [ ] Crear tallas para "Zapatos":
  - 38, 39, 40, 41, 42
- [ ] Crear tallas para "Camisas":
  - S, M, L, XL
- [ ] Verificar que aparezcan en la lista con su categoría asociada
- [ ] Intentar crear talla sin seleccionar categoría (debe fallar)

### 7. Creación Masiva de Productos
**URL**: http://localhost:3000/inventory/bulk-entry

- [ ] Verificar que la página cargue correctamente
- [ ] Verificar que el selector de proveedores tenga datos
- [ ] Seleccionar un proveedor
- [ ] Verificar que el selector de marcas se cargue con las marcas del proveedor
- [ ] Agregar un modelo nuevo:
  - Código base: "TEST001"
  - Nombre: "Zapato Deportivo Test"
  - Línea: "Damas"
  - Categoría: "Zapatos"
  - Marca: "Nike Test"
  - Color: "Negro"
  - Precio compra: 50
  - Precio venta: 100
- [ ] Verificar que al seleccionar categoría "Zapatos", las tallas se carguen automáticamente
- [ ] Agregar variantes de tallas:
  - Talla 38: 5 unidades
  - Talla 39: 10 unidades
  - Talla 40: 8 unidades
- [ ] Guardar el modelo
- [ ] Verificar que se cree correctamente

### 8. Validaciones de Integridad

#### Relaciones Requeridas
- [ ] Intentar crear categoría sin línea existente
- [ ] Intentar crear talla sin categoría existente
- [ ] Intentar crear marca sin proveedor existente
- [ ] Intentar crear producto sin marca/categoría/talla

#### Eliminación con Dependencias
- [ ] Intentar eliminar línea que tiene categorías (debe fallar)
- [ ] Intentar eliminar categoría que tiene tallas (debe fallar)
- [ ] Intentar eliminar proveedor que tiene marcas (debe fallar)

### 9. Búsqueda y Filtros
- [ ] En cada catálogo, probar la búsqueda por nombre
- [ ] Verificar que los filtros funcionen correctamente
- [ ] Verificar paginación si hay muchos registros

### 10. Interfaz de Usuario
- [ ] Verificar que todos los botones sean visibles y accesibles
- [ ] Verificar que los mensajes de error sean claros
- [ ] Verificar que los mensajes de éxito aparezcan
- [ ] Verificar que los diálogos se abran y cierren correctamente
- [ ] Verificar que los selectores desplegables funcionen

## Casos de Error Esperados

### Deben Fallar con Mensaje Claro:
1. Crear categoría sin línea
2. Crear talla sin categoría
3. Crear marca sin proveedor
4. Crear producto sin campos requeridos
5. Eliminar registros con dependencias

### Deben Funcionar:
1. Crear todos los catálogos en orden correcto
2. Editar registros existentes
3. Desactivar registros en lugar de eliminar
4. Crear productos masivos con múltiples variantes

## Herramientas de Playwright a Usar

```javascript
// Navegación
playwright_navigate({ url: "http://localhost:3000/catalogs/suppliers" })

// Obtener snapshot de la página
playwright_snapshot()

// Hacer clic en elementos
playwright_click({ selector: "button:has-text('Crear Proveedor')" })

// Llenar formularios
playwright_fill({ selector: "input[name='name']", value: "Proveedor Test" })

// Verificar texto
playwright_expect({ selector: "table", assertion: "toContainText", expected: "Proveedor Test" })
```

## Resultados Esperados

Al finalizar todas las pruebas:
- ✅ Todos los catálogos deben tener datos de prueba
- ✅ Las relaciones deben estar correctamente enlazadas
- ✅ Los productos masivos deben crearse con todas sus variantes
- ✅ Las validaciones deben prevenir datos inconsistentes
- ✅ La interfaz debe ser intuitiva y sin errores
