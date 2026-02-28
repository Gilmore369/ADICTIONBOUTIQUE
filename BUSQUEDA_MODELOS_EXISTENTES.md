# Búsqueda de Modelos Existentes en Ingreso Masivo

## Descripción

Se ha implementado una nueva funcionalidad en el panel de **Ingreso Masivo de Productos** que permite:

1. **Buscar modelos existentes** por nombre base
2. **Cargar automáticamente** todos los datos del modelo (código, línea, categoría, marca, color, precios, imagen)
3. **Actualizar stock** si es el mismo modelo
4. **Crear variantes** con nuevo código si es un color o variante diferente

## Cómo Funciona

### Paso 1: Seleccionar Proveedor y Tienda
- Selecciona el proveedor en el dropdown
- Selecciona la tienda destino (Tienda Mujeres o Tienda Hombres)

### Paso 2: Buscar Modelo Existente
Una vez seleccionado el proveedor, aparecerá una sección azul con:
- **Búsqueda de Modelo Existente**: Campo de búsqueda para encontrar modelos ya creados
- Escribe el nombre del modelo (ej: "Chaleco Army", "Blusa Casual")
- Se mostrarán los modelos coincidentes con:
  - Nombre del modelo
  - Código base
  - Categoría y marca
  - Número de variantes disponibles
  - Colores disponibles

### Paso 3: Seleccionar Modelo
- Haz clic en el modelo que deseas
- Se cargarán automáticamente todos sus datos:
  - ✅ Código base
  - ✅ Nombre base
  - ✅ Línea
  - ✅ Categoría
  - ✅ Marca
  - ✅ Color base
  - ✅ Imagen
  - ✅ Precio de compra
  - ✅ Precio de venta
  - ✅ Tallas disponibles

### Paso 4: Actualizar Stock o Crear Variante

#### Opción A: Actualizar Stock (Mismo Modelo)
Si es el **mismo modelo** (mismo color, talla, etc.):
1. El modelo se carga con todos sus datos
2. Selecciona las tallas que deseas actualizar
3. Ingresa las cantidades
4. Haz clic en "Guardar Todo"
5. El stock se actualizará automáticamente

#### Opción B: Crear Variante (Diferente Color)
Si es una **variante diferente** (otro color, por ejemplo):
1. El modelo se carga con todos sus datos
2. **Modifica el color** en el campo "Color Base"
3. Selecciona las tallas
4. Ingresa las cantidades
5. Haz clic en "Guardar Todo"
6. Se creará un **nuevo código** automáticamente
7. Los productos se crearán como nuevas variantes

## Ejemplo Práctico

### Escenario 1: Restock del Mismo Modelo
```
Proveedor: Importaciones del Sur
Tienda: Tienda Hombres

Búsqueda: "Chaleco Army"
Resultado: Chaleco Army (CHA-001)
  - Categoría: Chalecos
  - Marca: ARMY EE.UU
  - Color: Negro
  - Precio Compra: S/ 45.00
  - Precio Venta: S/ 89.90

Acción:
1. Se carga el modelo con todos los datos
2. Selecciono tallas: S, M, L, XL
3. Ingreso cantidades: 5, 10, 8, 3
4. Guardo
5. Stock se actualiza en la tienda Hombres
```

### Escenario 2: Crear Variante con Nuevo Color
```
Proveedor: Importaciones del Sur
Tienda: Tienda Mujeres

Búsqueda: "Chaleco Army"
Resultado: Chaleco Army (CHA-001)
  - Color actual: Negro

Acción:
1. Se carga el modelo
2. Cambio color a: Rojo
3. Selecciono tallas: S, M, L
4. Ingreso cantidades: 4, 6, 5
5. Guardo
6. Se crea nuevo código: CHA-002 (automático)
7. Se crean productos:
   - CHA-002-S (Chaleco Army - S, Rojo)
   - CHA-002-M (Chaleco Army - M, Rojo)
   - CHA-002-L (Chaleco Army - L, Rojo)
```

## Componentes Implementados

### 1. API: `/api/products/search-by-name`
- **Método**: GET
- **Parámetros**:
  - `q`: Nombre del modelo a buscar
  - `supplier_id`: ID del proveedor (para filtrar)
- **Retorna**: Lista de modelos agrupados por nombre base con todas sus variantes

### 2. Componente: `ModelSearch`
- Búsqueda con debounce (300ms)
- Dropdown con resultados
- Muestra información del modelo y variantes
- Integración con el formulario de ingreso masivo

### 3. Función: `loadExistingModel`
- Carga los datos del modelo seleccionado
- Carga automáticamente las tallas disponibles
- Prepara el formulario para edición

## Flujo de Datos

```
Usuario escribe nombre
        ↓
Debounce 300ms
        ↓
API /api/products/search-by-name
        ↓
Agrupa por nombre base
        ↓
Retorna modelos con variantes
        ↓
Usuario selecciona modelo
        ↓
loadExistingModel()
        ↓
Carga datos en formulario
        ↓
Usuario modifica (color, cantidades, etc.)
        ↓
Guarda con createBulkProducts
        ↓
Actualiza stock o crea nuevos productos
```

## Casos de Uso

✅ **Restock de productos existentes**
- Mismo modelo, mismo color, mismas tallas
- Solo actualiza cantidades

✅ **Nuevas variantes del mismo modelo**
- Mismo modelo, diferente color
- Crea nuevo código automáticamente

✅ **Diferentes tallas del mismo modelo**
- Mismo modelo, mismo color, diferentes tallas
- Actualiza stock de tallas existentes

✅ **Búsqueda rápida**
- No necesitas recordar códigos
- Busca por nombre del modelo

## Notas Técnicas

- La búsqueda es **case-insensitive**
- Filtra por proveedor automáticamente
- Agrupa variantes por nombre base
- Carga tallas dinámicamente según categoría
- Genera códigos automáticamente al cambiar categoría
- Mantiene proveedor y tienda seleccionados para carga continua

## Próximas Mejoras

- [ ] Historial de búsquedas recientes
- [ ] Favoritos de modelos frecuentes
- [ ] Importación desde Excel con búsqueda automática
- [ ] Sugerencias inteligentes basadas en historial
