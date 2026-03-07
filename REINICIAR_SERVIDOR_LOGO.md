# REINICIAR SERVIDOR PARA CARGAR EL LOGO

## El Problema
El logo está en `public/images/logo.png` pero el servidor Next.js necesita reiniciarse para cargarlo.

## Solución Inmediata

### Paso 1: Detener el Servidor
En la terminal donde está corriendo `npm run dev`, presiona:
```
Ctrl + C
```

### Paso 2: Reiniciar el Servidor
```bash
npm run dev
```

### Paso 3: Esperar a que cargue
Espera a ver este mensaje:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- Ready in X.Xs
```

### Paso 4: Probar el PDF
1. Ve a http://localhost:3000/pos
2. Haz una venta rápida
3. Descarga el PDF
4. El logo DEBE aparecer ahora

## Verificación del Logo

El logo está correctamente ubicado:
- ✅ Archivo: `public/images/logo.png`
- ✅ Tamaño: 116,757 bytes (114 KB)
- ✅ Formato: JPG (convertido a PNG)

## Si Aún No Aparece

Si después de reiniciar el servidor el logo NO aparece en el PDF, ejecuta este comando para verificar:

```bash
node -e "const fs = require('fs'); const path = require('path'); const logoPath = path.join(process.cwd(), 'public', 'images', 'logo.png'); console.log('Logo existe:', fs.existsSync(logoPath)); if (fs.existsSync(logoPath)) { const stats = fs.statSync(logoPath); console.log('Tamaño:', stats.size, 'bytes'); }"
```

Debe mostrar:
```
Logo existe: true
Tamaño: 116757 bytes
```

## Alternativa: Limpiar Caché

Si el problema persiste:

```bash
# Detener el servidor (Ctrl + C)

# Limpiar caché de Next.js
rm -rf .next

# Reiniciar
npm run dev
```

## IMPORTANTE

El logo YA ESTÁ en la ubicación correcta. Solo necesitas **REINICIAR EL SERVIDOR** para que lo cargue.
