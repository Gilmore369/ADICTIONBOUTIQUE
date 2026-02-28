# Verificación: Extracción de Coordenadas de Google Maps

## ✅ Cambios Completados

### 1. API Endpoint (`/api/expand-url`)
- ✅ Agregado handler POST para aceptar `{ url: string }`
- ✅ Validación mejorada para soportar `goo.gl` y `maps.app.goo.gl`
- ✅ Respuesta consistente con `{ success: boolean, expandedUrl: string }`
- ✅ Handler GET mantenido para compatibilidad

### 2. Formulario POS (`CreateClientDialog`)
- ✅ Llamada API corregida a POST con JSON body
- ✅ Soporte para links acortados `goo.gl`
- ✅ Notificaciones toast durante procesamiento
- ✅ Validación de coordenadas extraídas
- ✅ Agregado handler `onPaste` para mejor UX (extrae automáticamente al pegar)
- ✅ Campo `onChange` mantiene funcionalidad manual

### 3. Formulario CRM (`ClientForm`)
- ✅ Llamada API corregida a POST con JSON body
- ✅ Soporte para links acortados `goo.gl` (agregado a validación)
- ✅ Handler `onPaste` ya existente, mejorado con soporte `goo.gl`
- ✅ Consistente con CreateClientDialog

## 🧪 Pruebas Recomendadas

### Prueba 1: POS - Link Acortado
1. Ir a `/pos`
2. Seleccionar tipo de venta "CREDITO"
3. Hacer clic en "Nuevo cliente"
4. En el campo "Link de Google Maps", pegar: `https://maps.app.goo.gl/i7uBK2yJ9Hy6acuy6`
5. **Resultado esperado**: 
   - Toast "Procesando: Extrayendo coordenadas del link..."
   - Toast "Éxito: Coordenadas extraídas: [lat], [lng]"
   - Campos Latitud y Longitud se llenan automáticamente
   - Mensaje "Coords OK" aparece

### Prueba 2: CRM - Link Acortado
1. Ir a `/clients`
2. Hacer clic en "Nuevo Cliente"
3. En el campo "Link de Google Maps", pegar: `https://maps.app.goo.gl/i7uBK2yJ9Hy6acuy6`
4. **Resultado esperado**: Igual que Prueba 1

### Prueba 3: Link Completo (Verificar que sigue funcionando)
1. En cualquier formulario de cliente
2. Pegar: `https://www.google.com/maps/@-12.0464,-77.0428,17z`
3. **Resultado esperado**: Coordenadas extraídas correctamente

### Prueba 4: Link Inválido
1. En cualquier formulario de cliente
2. Pegar: `https://example.com/not-a-map`
3. **Resultado esperado**: 
   - Toast de error
   - Mensaje "No se pudo extraer coordenadas"

## 📋 Formatos de URL Soportados

| Formato | Ejemplo | Estado |
|---------|---------|--------|
| Link acortado | `https://maps.app.goo.gl/xxxxx` | ✅ NUEVO |
| Link acortado genérico | `https://goo.gl/maps/xxxxx` | ✅ NUEVO |
| Formato @lat,lng | `https://google.com/maps/@-12.04,-77.04,17z` | ✅ |
| Formato ?q= | `https://maps.google.com/?q=-12.04,-77.04` | ✅ |
| Formato ll= | `https://maps.google.com/?ll=-12.04,-77.04` | ✅ |
| Formato place | `https://google.com/maps/place/.../@-12.04,-77.04` | ✅ |

## 🔧 Archivos Modificados

```
app/api/expand-url/route.ts          - Agregado POST handler
components/clients/create-client-dialog.tsx  - Corregido método API
components/clients/client-form.tsx            - Corregido método API
```

## ✅ Compilación

```bash
npm run build
```
**Estado**: ✅ Sin errores

## 🚀 Próximos Pasos

1. Reiniciar el servidor de desarrollo si está corriendo
2. Probar con el link real: `https://maps.app.goo.gl/i7uBK2yJ9Hy6acuy6`
3. Verificar que las coordenadas se extraen correctamente
4. Crear un cliente de prueba con coordenadas extraídas
5. Verificar que el cliente se guarda con lat/lng correctos

## 📝 Notas

- El sistema ahora expande automáticamente los links acortados
- La extracción es asíncrona y muestra feedback al usuario
- Los campos de latitud/longitud siguen siendo opcionales
- Las coordenadas se validan (lat: -90 a 90, lng: -180 a 180)
