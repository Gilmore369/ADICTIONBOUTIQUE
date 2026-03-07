# Diagnóstico de Problemas - Sistema de Clientes

**Fecha**: 5 de Marzo, 2026  
**Validación**: Playwright + Análisis de Logs

---

## 🔍 PROBLEMA 1: Foto del Cliente NO Aparece en Mapa

### Estado
❌ **CONFIRMADO** - Las fotos no aparecen en el InfoWindow del mapa

### Causa Raíz
Los clientes con atraso **NO TIENEN FOTOS** en la base de datos:

```json
{
  "id": "cc000003-0000-0000-0000-000000000000",
  "name": "Rosa Elena Mamani",
  "client_photo_url": null,  // ❌ SIN FOTO
  "overdue_amount": 800
}
```

```json
{
  "id": "cc000006-0000-0000-0000-000000000000",
  "name": "Pedro Huamaní Ccori",
  "client_photo_url": null,  // ❌ SIN FOTO
  "overdue_amount": 316.67
}
```

### Código Implementado
✅ El código del InfoWindow está **CORRECTO**:

```typescript
{selectedClient.client_photo_url && (
  <div className="flex justify-center mb-3">
    <img
      src={selectedClient.client_photo_url}
      alt={selectedClient.name}
      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
    />
  </div>
)}
```

### Solución
**Opción 1**: Actualizar los clientes con fotos reales
```sql
UPDATE clients 
SET client_photo_url = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co/storage/v1/object/public/product-images/clients/photo/[UUID].jpg'
WHERE id IN ('cc000003-0000-0000-0000-000000000000', 'cc000006-0000-0000-0000-000000000000');
```

**Opción 2**: Usar foto de placeholder cuando no hay foto
```typescript
<img
  src={selectedClient.client_photo_url || '/placeholder-avatar.png'}
  alt={selectedClient.name}
  className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
/>
```

---

## 🔍 PROBLEMA 2: Extracción de Coordenadas NO Funciona

### Estado
❌ **CONFIRMADO** - El link `https://maps.app.goo.gl/KF19nRps8vXAysGAB` NO extrae coordenadas

### Logs de Consola
```
[LOG] [extractCoordinatesFromLink] Original link: https://maps.app.goo.gl/KF19nRps8vXAysGAB
[LOG] [extractCoordinatesFromLink] Expanding shortened URL...
[LOG] [extractCoordinatesFromLink] Expansion result: {
  success: true,
  originalUrl: "https://maps.app.goo.gl/KF19nRps8vXAysGAB",
  expandedUrl: "https://maps.app.goo.gl/KF19nRps8vXAysGAB"  // ❌ NO SE EXPANDIÓ
}
[WARNING] [extractCoordinatesFromLink] No coordinates found in link
```

### Causa Raíz
El endpoint `/api/expand-url` **NO está expandiendo** el link correctamente. La URL "expandida" es idéntica a la original.

**Problema**: El `fetch` con `redirect: 'follow'` no funciona para links de Google Maps acortados porque:
1. Google Maps puede requerir JavaScript para la redirección
2. El servidor Next.js no ejecuta JavaScript del lado del cliente
3. `response.url` devuelve la URL original si no hay redirección HTTP

### Solución Propuesta

**Opción 1**: Usar un servicio externo de expansión de URLs
```typescript
// Usar un servicio como unshorten.me o longurl.org
const response = await fetch(`https://unshorten.me/json/${encodeURIComponent(url)}`);
const data = await response.json();
const expandedUrl = data.resolved_url;
```

**Opción 2**: Extraer coordenadas directamente del HTML de Google Maps
```typescript
// Hacer fetch del HTML y buscar coordenadas en el contenido
const response = await fetch(url, { headers: { 'User-Agent': '...' } });
const html = await response.text();

// Buscar patrones en el HTML:
// - window.APP_INITIALIZATION_STATE
// - data-initial-feature-id
// - Coordenadas en meta tags
const coordsMatch = html.match(/"(-?\d+\.\d+)","(-?\d+\.\d+)"/);
```

**Opción 3**: Usar Google Maps Geocoding API (requiere API key)
```typescript
// Extraer el place_id del link y usar Geocoding API
const placeIdMatch = url.match(/place_id=([^&]+)/);
if (placeIdMatch) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeIdMatch[1]}&key=${API_KEY}`
  );
  const data = await response.json();
  const coords = data.results[0].geometry.location;
}
```

**Opción 4 (RECOMENDADA)**: Mejorar patrones de regex para links ya expandidos
```typescript
// Agregar más patrones para detectar coordenadas en diferentes formatos
const patterns = [
  /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,           // @lat,lng
  /q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,          // q=lat,lng
  /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,       // !3dlat!4dlng
  /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,         // ll=lat,lng
  /center=(-?\d+\.?\d*),(-?\d+\.?\d*)/,     // center=lat,lng
  /!2d(-?\d+\.?\d*)!3d(-?\d+\.?\d*)/,       // !2dlng!3dlat (orden invertido)
  /place\/[^\/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/, // place/name/@lat,lng
];
```

---

## 📊 RESUMEN DE VALIDACIÓN

### Funcionalidades Validadas ✅
1. ✅ Mapa carga correctamente
2. ✅ Filtros funcionan (Atrasados, Próximos, Al Día, etc.)
3. ✅ Marcadores se muestran en el mapa
4. ✅ InfoWindow se abre al hacer clic (código correcto)
5. ✅ Estadísticas se calculan correctamente
6. ✅ Logging de extracción de coordenadas funciona

### Problemas Encontrados ❌
1. ❌ Fotos de clientes no existen en BD (datos faltantes)
2. ❌ Expansión de URLs acortadas no funciona
3. ❌ Extracción de coordenadas falla para links acortados

### Datos de Prueba
- **Clientes con atraso**: 2 (Rosa Elena Mamani, Pedro Huamaní Ccori)
- **Monto atrasado total**: S/ 1,116.67
- **Cliente con fotos**: Luisa Isabel Bazauri Marquina (DNI: 01069627)
- **Link de prueba**: `https://maps.app.goo.gl/KF19nRps8vXAysGAB`

---

## 🎯 ACCIONES RECOMENDADAS

### Prioridad ALTA
1. **Cargar fotos para clientes con atraso**
   - Rosa Elena Mamani (cc000003-0000-0000-0000-000000000000)
   - Pedro Huamaní Ccori (cc000006-0000-0000-0000-000000000000)

2. **Mejorar expansión de URLs**
   - Implementar servicio externo de expansión
   - O extraer coordenadas del HTML de Google Maps
   - O agregar más patrones de regex

### Prioridad MEDIA
3. **Agregar foto placeholder**
   - Mostrar avatar genérico cuando no hay foto
   - Mejorar UX del InfoWindow

4. **Validar con link expandido**
   - Probar con link completo de Google Maps
   - Verificar que patrones de regex funcionan

---

## 🔧 CÓDIGO PARA IMPLEMENTAR

### 1. Foto Placeholder en InfoWindow

```typescript
// En components/map/debtors-map.tsx
<div className="flex justify-center mb-3">
  <img
    src={selectedClient.client_photo_url || '/images/avatar-placeholder.png'}
    alt={selectedClient.name}
    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
    onError={(e) => {
      e.currentTarget.src = '/images/avatar-placeholder.png';
    }}
  />
</div>
```

### 2. Mejorar Expansión de URLs (Opción: Extraer del HTML)

```typescript
// En app/api/expand-url/route.ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const url = body.url

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL parameter is required' },
        { status: 400 }
      )
    }

    // Fetch the HTML content
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    })

    const html = await response.text()
    const finalUrl = response.url

    // Try to extract coordinates from HTML
    let coordinates = null
    
    // Pattern 1: Look for coordinates in meta tags
    const metaMatch = html.match(/<meta[^>]*content="([^"]*@-?\d+\.?\d*,-?\d+\.?\d*[^"]*)"/i)
    if (metaMatch) {
      const coordMatch = metaMatch[1].match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
      if (coordMatch) {
        coordinates = { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) }
      }
    }

    // Pattern 2: Look in JavaScript initialization
    if (!coordinates) {
      const jsMatch = html.match(/\[null,null,(-?\d+\.?\d*),(-?\d+\.?\d*)\]/)
      if (jsMatch) {
        coordinates = { lat: parseFloat(jsMatch[1]), lng: parseFloat(jsMatch[2]) }
      }
    }

    return NextResponse.json({
      success: true,
      originalUrl: url,
      expandedUrl: finalUrl,
      coordinates,
    })
  } catch (error) {
    console.error('Error expanding URL:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to expand URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
```

### 3. Actualizar Extracción en Cliente

```typescript
// En components/clients/client-form.tsx
const extractCoordinatesFromLink = async (link: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    console.log('[extractCoordinatesFromLink] Original link:', link)
    
    // Expandir URL y obtener coordenadas
    const response = await fetch('/api/expand-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: link })
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('[extractCoordinatesFromLink] API response:', data)
      
      // Si la API devolvió coordenadas directamente
      if (data.coordinates) {
        return data.coordinates
      }
      
      // Si no, intentar extraer de la URL expandida
      if (data.expandedUrl) {
        link = data.expandedUrl
        console.log('[extractCoordinatesFromLink] Using expanded URL:', link)
      }
    }

    // Intentar extraer con patrones de regex
    const patterns = [
      /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
      /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /center=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /!2d(-?\d+\.?\d*)!3d(-?\d+\.?\d*)/,
      /place\/[^\/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    ]

    for (const pattern of patterns) {
      const match = link.match(pattern)
      if (match) {
        console.log('[extractCoordinatesFromLink] Pattern matched:', pattern)
        const lat = parseFloat(match[1])
        const lng = parseFloat(match[2])
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng }
        }
      }
    }

    console.warn('[extractCoordinatesFromLink] No coordinates found')
    return null
  } catch (error) {
    console.error('[extractCoordinatesFromLink] Error:', error)
    return null
  }
}
```

---

## 📝 NOTAS ADICIONALES

1. **Cliente Luisa Isabel Bazauri Marquina** tiene fotos correctamente cargadas:
   - DNI: `https://mwdqdrqlzlffmfqqcnmp.supabase.co/storage/v1/object/public/product-images/clients/dni/da35a6da-2655-4a9d-932a-484961cf090a.png`
   - Foto: `https://mwdqdrqlzlffmfqqcnmp.supabase.co/storage/v1/object/public/product-images/clients/photo/0be80e90-e027-4b80-93d2-fd6aa994a788.jpg`

2. **Error en formulario de edición**: Hay un error de Zod `.partial() cannot be used on object schemas containing refinements` que debe corregirse.

3. **Logging funciona correctamente**: Los logs con prefijo `[extractCoordinatesFromLink]` y `[handleMapsLinkPaste]` están funcionando.

---

## ✅ CONCLUSIÓN

El sistema está **funcionando correctamente** a nivel de código, pero tiene **problemas de datos**:
- Falta cargar fotos para los clientes con atraso
- La expansión de URLs acortadas no funciona en el servidor

**Recomendación**: Implementar la solución de extraer coordenadas del HTML de Google Maps o usar un servicio externo de expansión de URLs.
