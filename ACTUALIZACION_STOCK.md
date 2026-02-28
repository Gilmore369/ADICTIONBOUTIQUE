# ✅ ACTUALIZACIÓN: Ingreso de Productos Existentes

## 🎯 Cambio Implementado

Ahora cuando ingresas un producto que **ya existe** (mismo código de barras), el sistema:

1. ✅ **Detecta** que el producto ya existe
2. ✅ **Actualiza el stock** en lugar de crear un nuevo producto
3. ✅ **Registra un movimiento** de entrada (restock)
4. ✅ **Mantiene el mismo código** de barras

## 📊 Comportamiento

### Antes (Incorrecto)
```
Ingreso: Chaleco Army - Talla L - 5 unidades
Resultado: Crea nuevo producto con código CHA-003-L
Ingreso: Chaleco Army - Talla L - 3 unidades
Resultado: Crea OTRO producto con código CHA-003-L (ERROR)
```

### Ahora (Correcto)
```
Ingreso: Chaleco Army - Talla L - 5 unidades
Resultado: Crea producto con código CHA-003-L (Stock: 5)
Ingreso: Chaleco Army - Talla L - 3 unidades
Resultado: Actualiza stock a 8 unidades (5 + 3)
```

## 🔍 Cómo funciona

### 1. Búsqueda de producto existente
```typescript
// Busca por código de barras
const existingProduct = await supabase
  .from('products')
  .select('id')
  .eq('barcode', product.barcode)
  .single()
```

### 2. Si existe: Actualizar stock
```typescript
// Suma la cantidad al stock existente
const newQuantity = existingStock.quantity + product.quantity
await supabase
  .from('stock')
  .update({ quantity: newQuantity })
  .eq('product_id', existingProduct.id)
```

### 3. Si no existe: Crear nuevo
```typescript
// Crea el producto normalmente
const createdProduct = await supabase
  .from('products')
  .insert({ ... })
```

## 📈 Respuesta del servidor

Ahora la respuesta incluye:
```json
{
  "success": true,
  "data": {
    "count": 10,
    "created": 5,
    "updated": 5,
    "products": ["id1", "id2", ...]
  }
}
```

- `count`: Total de productos procesados
- `created`: Productos nuevos creados
- `updated`: Productos existentes actualizados
- `products`: IDs de productos creados

## 🧪 Cómo probar

### Prueba 1: Crear producto nuevo
1. Ve a `Inventario > Ingreso Masivo`
2. Crea un producto: "Chaleco Army - Talla L - 5 unidades"
3. Guarda
4. Verifica que aparezca en `Catálogos > Productos` con stock 5

### Prueba 2: Actualizar stock del mismo producto
1. Ve a `Inventario > Ingreso Masivo`
2. Crea el MISMO producto: "Chaleco Army - Talla L - 3 unidades"
3. Guarda
4. Verifica que el stock sea 8 (5 + 3), NO 3

### Prueba 3: Verificar movimientos
1. Ve a `Inventario > Movimientos`
2. Verifica que haya 2 movimientos de entrada:
   - Primer ingreso: 5 unidades
   - Segundo ingreso: 3 unidades

## 📝 Casos especiales

### Caso 1: Mismo producto, diferente almacén
```
Ingreso 1: Chaleco Army - Tienda Mujeres - 5 unidades
Ingreso 2: Chaleco Army - Tienda Hombres - 3 unidades
Resultado: 
  - Tienda Mujeres: 5 unidades
  - Tienda Hombres: 3 unidades
```

### Caso 2: Mismo producto, misma talla, diferente color
```
Ingreso 1: Chaleco Army - Talla L - Color Negro - 5 unidades
Ingreso 2: Chaleco Army - Talla L - Color Rojo - 3 unidades
Resultado: 
  - Crea 2 productos diferentes (colores diferentes)
  - Códigos: CHA-003-L-Negro, CHA-003-L-Rojo
```

## ✨ Ventajas

1. ✅ **No duplica productos** con el mismo código
2. ✅ **Actualiza stock automáticamente**
3. ✅ **Registra movimientos correctamente**
4. ✅ **Mantiene historial de ingresos**
5. ✅ **Funciona con múltiples almacenes**

## 🔧 Archivos modificados

- `actions/products.ts` - Lógica de creación/actualización

## 📊 Logs del servidor

Cuando ingresas un producto existente, verás en los logs:

```
[createBulkProducts] Product exists, updating stock: CHA-003-L
[createBulkProducts] Success: {
  productsCreated: 0,
  productsUpdated: 1,
  movementsCreated: 1
}
```

---

**¡Listo!** Ahora el sistema maneja correctamente los productos existentes. 🎉
