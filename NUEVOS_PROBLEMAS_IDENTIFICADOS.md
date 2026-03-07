# Nuevos Problemas Identificados

**Fecha**: 5 de Marzo, 2026

---

## 🔍 PROBLEMA 1: No se puede crear cliente desde POS

### Descripción
Al intentar crear un cliente desde el POS, aparece un error.

### Causa Probable
El sistema requiere que todos los clientes nuevos tengan un "referido por" (campo obligatorio), pero en el POS esto no tiene sentido - los clientes que llegan a la tienda no necesariamente fueron referidos.

### Solución Propuesta
**Opción 1** (RECOMENDADA): Hacer el campo "referido por" opcional en el formulario de creación rápida del POS
- Mantener la validación obligatoria en el formulario completo de clientes
- Permitir crear clientes sin referido desde el POS

**Opción 2**: Crear un cliente "Sistema" o "Walk-in" que sea el referidor por defecto para clientes del POS

---

## 🔍 PROBLEMA 2: POS no filtra productos por tienda

### Descripción
Cuando se selecciona "Tienda Hombres", el POS debería mostrar SOLO los productos disponibles en esa tienda, pero muestra todos los productos.

### Comportamiento Esperado
1. Usuario selecciona "Tienda Hombres" en el selector de tienda
2. El POS debe filtrar productos para mostrar solo los que tienen stock en "Tienda Hombres"
3. El selector de tienda debe bloquearse (disabled) una vez seleccionado
4. Solo se pueden vender productos de esa tienda

### Solución Propuesta
1. Filtrar productos por `warehouse_id` de la tienda seleccionada
2. Verificar stock en la tienda específica
3. Deshabilitar el selector de tienda después de agregar el primer producto al carrito

---

## 🔍 PROBLEMA 3: Error en el mapa

### Descripción
Hay un error en el mapa (no especificado en el mensaje).

### Información Necesaria
- ¿Qué error específico aparece?
- ¿Es el mismo error de las coordenadas?
- ¿O es un error diferente?

### Posibles Causas
1. Error de extracción de coordenadas (ya corregido, requiere hard refresh)
2. Error al cargar el mapa
3. Error al mostrar marcadores
4. Error en el InfoWindow

---

## 📋 PLAN DE ACCIÓN

### Prioridad ALTA

1. **Arreglar creación de cliente en POS**
   - Hacer "referido por" opcional en POS
   - Mantener validación en formulario completo

2. **Implementar filtro de productos por tienda en POS**
   - Filtrar por warehouse_id
   - Verificar stock en tienda específica
   - Bloquear selector después de agregar producto

3. **Identificar y corregir error del mapa**
   - Necesito más información sobre el error específico

---

## 🔧 ARCHIVOS A MODIFICAR

### Para Problema 1 (Cliente en POS)
- `components/clients/create-client-dialog.tsx` - Hacer referido opcional
- `lib/validations/catalogs.ts` - Ajustar validación
- `actions/catalogs.ts` - Permitir crear sin referido

### Para Problema 2 (Filtro POS)
- `app/(auth)/pos/page.tsx` - Implementar filtro por tienda
- Query de productos - Agregar filtro por warehouse_id

### Para Problema 3 (Mapa)
- Depende del error específico

---

## ❓ PREGUNTAS PARA EL USUARIO

1. **Sobre el error del mapa**: ¿Qué mensaje de error específico aparece? ¿Puedes compartir un screenshot o el texto del error?

2. **Sobre clientes en POS**: ¿Prefieres que los clientes del POS no requieran referido, o que tengan un referidor por defecto como "Walk-in"?

3. **Sobre el filtro de tienda**: ¿El selector de tienda debe bloquearse después de agregar el primer producto, o puede cambiarse en cualquier momento?

---

## 🎯 PRÓXIMOS PASOS

1. Esperar confirmación del usuario sobre las preguntas
2. Implementar solución para creación de cliente en POS
3. Implementar filtro de productos por tienda
4. Corregir error del mapa (una vez identificado)
