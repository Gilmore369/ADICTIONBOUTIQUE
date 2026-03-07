# Validación de Catálogos y Productos

## Estado de Revisión del Código

### ✅ Formularios Validados

#### 1. Líneas (Lines)
- **Campos requeridos**: ✅ Nombre
- **Campos opcionales**: ✅ Descripción
- **Validaciones**: 
  - Nombre máximo 100 caracteres
  - Campo requerido marcado con asterisco

#### 2. Categorías (Categories)
- **Campos requeridos**: ✅ Nombre, ✅ Línea (line_id)
- **Campos opcionales**: ✅ Descripción
- **Relaciones**: ✅ Enlazada a Líneas
- **Validaciones**:
  - Nombre máximo 100 caracteres
  - Selector de línea con datos activos
  - Campos requeridos marcados

#### 3. Marcas (Brands)
- **Campos requeridos**: ✅ Nombre, ✅ Proveedores (mínimo 1)
- **Campos opcionales**: ✅ Descripción
- **Relaciones**: ✅ Enlazada a Proveedores (relación muchos a muchos)
- **Validaciones**:
  - Nombre máximo 100 caracteres
  - Validación de al menos un proveedor seleccionado
  - Checkbox múltiple para proveedores
  - Mensaje de error si no hay proveedores seleccionados

#### 4. Tallas (Sizes)
- **Campos requeridos**: ✅ Nombre, ✅ Categoría (category_id)
- **Relaciones**: ✅ Enlazada a Categorías
- **Validaciones**:
  - Nombre máximo 50 caracteres
  - Selector de categoría con datos activos
  - Campos requeridos marcados

#### 5. Proveedores (Suppliers)
- **Campos requeridos**: ✅ Nombre
- **Campos opcionales**: ✅ Contacto, Teléfono, Email, Dirección, Notas
- **Validaciones**:
  - Nombre máximo 100 caracteres
  - Validación de tipo email
  - Validación de tipo teléfono

### ✅ Acciones del Servidor Validadas

Todas las acciones en `actions/catalogs.ts` incluyen:
- ✅ Validación de autenticación
- ✅ Validación de campos requeridos
- ✅ Manejo de errores
- ✅ Transacciones para operaciones complejas (marcas con proveedores)
- ✅ Verificación de relaciones antes de eliminar

### 🔍 Jerarquía de Dependencias

```
Proveedores (independiente)
    ↓
Marcas (requiere Proveedores)

Líneas (independiente)
    ↓
Categorías (requiere Líneas)
    ↓
Tallas (requiere Categorías)
    ↓
Productos (requiere: Marca, Categoría, Talla)
```

## Pruebas Manuales Recomendadas

### Orden de Creación (para evitar errores)

1. **Crear Proveedores primero**
   - Navegar a: http://localhost:3000/catalogs/suppliers
   - Crear al menos 2 proveedores de prueba

2. **Crear Líneas**
   - Navegar a: http://localhost:3000/catalogs/lines
   - Crear líneas: "Damas", "Caballeros", "Niños"

3. **Crear Categorías**
   - Navegar a: http://localhost:3000/catalogs/categories
   - Crear categorías para cada línea: "Zapatos", "Camisas", "Pantalones"
   - Verificar que el selector de líneas muestre las líneas creadas

4. **Crear Marcas**
   - Navegar a: http://localhost:3000/catalogs/brands
   - Crear marcas: "Nike", "Adidas", "Puma"
   - Seleccionar al menos un proveedor para cada marca
   - Verificar que no permita guardar sin proveedores

5. **Crear Tallas**
   - Navegar a: http://localhost:3000/catalogs/sizes
   - Crear tallas para cada categoría
   - Para zapatos: 38, 39, 40, 41, 42
   - Para ropa: S, M, L, XL
   - Verificar que el selector de categorías muestre las categorías creadas

6. **Crear Productos (Masivo)**
   - Navegar a: http://localhost:3000/inventory/bulk-entry
   - Verificar que todos los selectores tengan datos:
     - Marcas
     - Categorías
     - Tallas (filtradas por categoría)

### Casos de Prueba Específicos

#### ❌ Casos que DEBEN fallar:

1. **Crear Categoría sin Línea**
   - Intentar crear categoría sin seleccionar línea
   - Debe mostrar error de validación

2. **Crear Marca sin Proveedores**
   - Intentar crear marca sin seleccionar proveedores
   - Debe mostrar mensaje: "Debes seleccionar al menos un proveedor"

3. **Crear Talla sin Categoría**
   - Intentar crear talla sin seleccionar categoría
   - Debe mostrar error de validación

4. **Eliminar Línea con Categorías**
   - Crear línea con categorías asociadas
   - Intentar eliminar la línea
   - Debe fallar con mensaje de error

5. **Eliminar Categoría con Tallas**
   - Crear categoría con tallas asociadas
   - Intentar eliminar la categoría
   - Debe fallar con mensaje de error

#### ✅ Casos que DEBEN funcionar:

1. **Crear todos los catálogos en orden**
   - Seguir el orden de dependencias
   - Todo debe crearse sin errores

2. **Editar registros existentes**
   - Modificar nombres y descripciones
   - Cambiar relaciones (línea de categoría, proveedores de marca)

3. **Filtrar y buscar**
   - Usar filtros en cada tabla
   - Buscar por nombre

4. **Desactivar en lugar de eliminar**
   - Desactivar registros que tienen dependencias
   - Verificar que no aparezcan en selectores

## Problemas Potenciales Identificados

### ⚠️ Áreas que requieren atención:

1. **Formulario de Marcas - Validación de Proveedores**
   - El formulario muestra mensaje de error si no hay proveedores
   - Pero los inputs hidden podrían no enviarse correctamente
   - **Recomendación**: Probar crear marca sin proveedores

2. **Creación Masiva de Productos**
   - Necesito revisar el componente de bulk-entry
   - Verificar que todos los campos estén correctamente enlazados

3. **Filtrado de Tallas por Categoría**
   - En la creación de productos, las tallas deben filtrarse según la categoría seleccionada
   - Necesito verificar esta lógica

## Próximos Pasos

1. ✅ Configurar Playwright MCP
2. 🔄 Esperar reconexión del servidor MCP
3. 🔄 Ejecutar pruebas automatizadas con Playwright
4. 🔄 Revisar componente de bulk-entry de productos
5. 🔄 Validar filtrado dinámico de tallas por categoría
