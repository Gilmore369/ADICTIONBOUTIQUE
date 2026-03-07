# 🚀 Guía Rápida: Ingreso Masivo de Productos

## 📍 Ubicación
`http://localhost:3000/inventory/bulk-entry`

## ⚡ Inicio Rápido (5 pasos)

### 1️⃣ Selecciona Proveedor y Almacén
```
┌─────────────────────────────────┐
│ Proveedor: [Distribuidora ABC ▼]│ ← Requerido
│ Almacén:   [Tienda Centro    ▼]│ ← Requerido
└─────────────────────────────────┘
```

### 2️⃣ Completa Datos del Modelo
```
┌─────────────────────────────────────────┐
│ Nombre:    [Blusa Casual            ]  │
│ Línea:     [Mujeres                ▼]  │
│ Categoría: [Blusas                 ▼]  │
│            → Código: BLS-001 (automático)│
│ Color:     [🎨 Rojo                 ]  │
│ Imagen:    [📷 Subir imagen...      ]  │
│ Marca:     [Fashion Brand          ▼]  │
│ P. Compra: [50.00                   ]  │
│ P. Venta:  [100.00                  ]  │
└─────────────────────────────────────────┘
```

### 3️⃣ Selecciona Tallas
```
┌─────────────────────────────────┐
│ ☐ XS   ☑ S   ☑ M   ☑ L   ☐ XL │
└─────────────────────────────────┘
```

### 4️⃣ Asigna Cantidades
```
┌──────────┬──────────┬──────────┐
│ Talla    │ Color    │ Cantidad │
├──────────┼──────────┼──────────┤
│ S        │ Rojo     │   [5]    │
│ M        │ Rojo     │  [10]    │
│ L        │ Rojo     │   [8]    │
└──────────┴──────────┴──────────┘
```

### 5️⃣ Guardar
```
┌─────────────────────────────────┐
│ [+ Agregar Modelo]              │
│              [💾 Guardar Todo]  │
└─────────────────────────────────┘
```

## 🎯 Casos de Uso Comunes

### Caso A: Producto Simple (1 talla)
```
✅ Seleccionar proveedor y almacén
✅ Ingresar nombre: "Blusa Casual"
✅ Seleccionar línea y categoría
✅ Ingresar color: "Rojo"
✅ Seleccionar marca
✅ Ingresar precios
✅ Seleccionar 1 talla: M
✅ Cantidad: 10
✅ Guardar

Resultado: 1 producto (BLS-001-M) con 10 unidades
```

### Caso B: Múltiples Tallas
```
✅ Mismo proceso que Caso A
✅ Seleccionar 3 tallas: S, M, L
✅ Cantidades: 5, 10, 8

Resultado: 3 productos (BLS-001-S, BLS-001-M, BLS-001-L)
Total: 23 unidades
```

### Caso C: Colores Personalizados
```
✅ Crear modelo con color base: "Blanco"
✅ Seleccionar tallas: S, M, L
✅ Personalizar colores:
   - S: Blanco (mantener)
   - M: Negro (cambiar) ← Badge "Personalizado"
   - L: Azul (cambiar)  ← Badge "Personalizado"

Resultado: 3 productos con colores diferentes
```

### Caso D: Múltiples Modelos
```
✅ Crear Modelo 1: "Blusa Floral"
✅ Clic en [+ Agregar Modelo]
✅ Crear Modelo 2: "Falda Plisada"
✅ Clic en [+ Agregar Modelo]
✅ Crear Modelo 3: "Zapato Tacón"
✅ Guardar Todo

Resultado: Todos los modelos se crean en una sola operación
```

### Caso E: Agregar Color a Modelo Existente
```
✅ Buscar modelo: "Zapato Casual"
✅ Seleccionar de resultados
✅ Sistema carga base_code: ZAP-001
✅ ⚠️ Advertencia: "Ingresa el NUEVO color"
✅ Ingresar color: "Café" (diferente al existente)
✅ Seleccionar tallas
✅ Guardar

Resultado: Nuevos productos con mismo base_name pero nuevo color
```

## 🎨 Características Especiales

### ColorPicker Inteligente
```
Color Base del Modelo: [🎨 Rojo]
                        ↓
        Se aplica a todas las tallas
                        ↓
    Puedes personalizar por talla:
    
┌──────────┬─────────────────────┐
│ Talla S  │ [🎨 Rojo]          │ ← Color base
│ Talla M  │ [🎨 Negro] 🏷️      │ ← Personalizado
│ Talla L  │ [🎨 Azul]  🏷️      │ ← Personalizado
└──────────┴─────────────────────┘
```

### Código Automático
```
Seleccionas Categoría: "Blusas"
           ↓
Sistema genera: BLS-001
           ↓
Al guardar crea:
  - BLS-001-S
  - BLS-001-M
  - BLS-001-L
```

### Creación Rápida
```
Cada selector tiene botón [+]:

Proveedor  [▼] [+] ← Crear sin salir
Marca      [▼] [+] ← Crear sin salir
Línea      [▼] [+] ← Crear sin salir
Categoría  [▼] [+] ← Crear sin salir
```

## ⚠️ Validaciones Importantes

### ❌ Error: Relación Proveedor-Marca
```
Proveedor: "Distribuidora A"
Marca:     "Marca X"
           ↓
❌ "El proveedor 'Distribuidora A' no vende 
    la marca 'Marca X'"
           ↓
✅ Solución: Cambiar a marca que venda ese proveedor
```

### ❌ Error: Campos Requeridos
```
Campos en rojo = Requeridos:
- Proveedor
- Almacén
- Nombre
- Línea
- Categoría
- Color
- Marca
- Precio Compra > 0
- Precio Venta > 0
- Al menos 1 talla
```

## 🔄 Actualización de Stock

### Si el producto YA EXISTE:
```
Primera carga:
  Camisa Básica M: 10 unidades
  Barcode: CAM-001-M
  
Segunda carga (mismo producto):
  Camisa Básica M: 5 unidades
  
Resultado:
  ✅ NO duplica
  ✅ Stock: 10 + 5 = 15 unidades
  ✅ Nuevo movimiento: +5
```

### Si el producto NO EXISTE:
```
Nueva carga:
  Camisa Básica M: 10 unidades
  
Resultado:
  ✅ Crea producto nuevo
  ✅ Stock: 10 unidades
  ✅ Movimiento: +10
```

## 📊 Contador de Productos

```
┌─────────────────────────────────────┐
│ [💾 Guardar Todo (23 productos)]   │
└─────────────────────────────────────┘
         ↑
    Suma automática de todas las 
    cantidades de todos los modelos
```

## 🎯 Tips y Trucos

### ✅ Tip 1: Carga Continua
```
Después de guardar:
✅ Proveedor se mantiene
✅ Almacén se mantiene
✅ Modelos se resetean

→ Puedes seguir cargando sin reseleccionar
```

### ✅ Tip 2: Organización
```
Con muchos modelos:
✅ Colapsa los completados (clic en header)
✅ Mantén expandido el que estás editando
✅ Elimina los que no necesites
```

### ✅ Tip 3: Imagen Compartida
```
Una imagen por modelo:
✅ Se aplica a todas las tallas
✅ Aparece en catálogo visual
✅ Agrupa productos por base_code
```

### ✅ Tip 4: Búsqueda de Modelos
```
Para agregar color a modelo existente:
✅ Busca el modelo
✅ Selecciónalo
✅ Sistema carga base_code
✅ Ingresa NUEVO color
✅ Selecciona tallas
```

## 🚨 Errores Comunes

### Error 1: "Selecciona un proveedor"
```
❌ Problema: Intentaste guardar sin proveedor
✅ Solución: Selecciona proveedor primero
```

### Error 2: "Completa todos los campos requeridos"
```
❌ Problema: Faltan campos obligatorios
✅ Solución: Revisa campos en rojo
```

### Error 3: "El proveedor no vende la marca"
```
❌ Problema: No existe relación en supplier_brands
✅ Solución: Cambia la marca o el proveedor
```

### Error 4: "Debes seleccionar al menos una talla"
```
❌ Problema: No seleccionaste tallas
✅ Solución: Marca al menos 1 checkbox de talla
```

## 📈 Flujo Visual

```
┌─────────────┐
│  INICIO     │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ Seleccionar         │
│ Proveedor + Almacén │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Buscar Modelo       │◄─── Opcional
│ Existente           │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Completar Datos     │
│ del Modelo          │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Seleccionar         │
│ Tallas              │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Asignar Cantidades  │
│ y Colores           │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ ¿Más modelos?       │
└──────┬──────────────┘
       │
   ┌───┴───┐
   │       │
  Sí      No
   │       │
   │       ▼
   │  ┌─────────────┐
   │  │ GUARDAR     │
   │  └──────┬──────┘
   │         │
   │         ▼
   │  ┌─────────────┐
   │  │ Validar     │
   │  │ Proveedor-  │
   │  │ Marca       │
   │  └──────┬──────┘
   │         │
   │         ▼
   │  ┌─────────────┐
   │  │ Buscar      │
   │  │ Productos   │
   │  │ Existentes  │
   │  └──────┬──────┘
   │         │
   │         ▼
   │  ┌─────────────┐
   │  │ Crear/      │
   │  │ Actualizar  │
   │  │ Productos   │
   │  └──────┬──────┘
   │         │
   │         ▼
   │  ┌─────────────┐
   │  │ Crear       │
   │  │ Movimientos │
   │  └──────┬──────┘
   │         │
   │         ▼
   │  ┌─────────────┐
   │  │ ✅ ÉXITO    │
   │  └─────────────┘
   │
   └──► [+ Agregar Modelo]
```

## 🎓 Resumen

El módulo de Ingreso Masivo es una herramienta poderosa que permite:

✅ Crear múltiples productos en una sola operación
✅ Gestionar variantes por talla y color
✅ Actualizar stock de productos existentes
✅ Generar códigos automáticamente
✅ Crear catálogos rápidamente
✅ Mantener trazabilidad con movimientos

**Todo con validaciones completas y mensajes claros en español.**
