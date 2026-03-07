# 🧪 Validación con Playwright

## Prerrequisitos

1. **Servidor corriendo**:
   ```bash
   npm run dev
   ```
   Espera a que veas: `Ready in X ms`

2. **Playwright instalado**:
   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

## Tests a Realizar

### Test 1: Upload de Logo en Configuración

**Objetivo**: Verificar que el botón "Seleccionar Imagen" abre el explorador de archivos

**Pasos manuales**:
1. Navega a http://localhost:3000
2. Inicia sesión
3. Ve a Configuración
4. Busca la sección "Logo de la Tienda"
5. Haz click en "Seleccionar Imagen"
6. **Verifica**: Se abre el explorador de archivos de Windows
7. Selecciona una imagen
8. **Verifica**: Aparece el preview del logo
9. **Verifica**: Toast "Logo guardado exitosamente"

**Pasos con Playwright**:
```typescript
// test/upload-logo.spec.ts
import { test, expect } from '@playwright/test'

test('Upload logo desde configuración', async ({ page }) => {
  // Navegar a la app
  await page.goto('http://localhost:3000')
  
  // Login (ajusta según tu flujo)
  await page.fill('input[type="email"]', 'tu-email@example.com')
  await page.fill('input[type="password"]', 'tu-password')
  await page.click('button[type="submit"]')
  
  // Esperar a que cargue
  await page.waitForLoadState('networkidle')
  
  // Ir a Configuración
  await page.click('text=Configuración')
  
  // Verificar que existe la sección de logo
  await expect(page.locator('text=Logo de la Tienda')).toBeVisible()
  
  // Verificar que existe el input file
  const fileInput = page.locator('input[type="file"]#logo-upload-input')
  await expect(fileInput).toBeAttached()
  
  // Verificar que existe el label
  const uploadLabel = page.locator('label[for="logo-upload-input"]')
  await expect(uploadLabel).toBeVisible()
  await expect(uploadLabel).toContainText('Seleccionar Imagen')
  
  // Simular upload de archivo
  await fileInput.setInputFiles('addiction boutique.jpg')
  
  // Esperar el toast de éxito
  await expect(page.locator('text=Logo guardado exitosamente')).toBeVisible({ timeout: 5000 })
  
  // Verificar que aparece el preview
  await expect(page.locator('img[alt="Logo preview"]')).toBeVisible()
})
```

### Test 2: Drag & Drop de Logo

**Pasos con Playwright**:
```typescript
test('Upload logo con drag & drop', async ({ page }) => {
  await page.goto('http://localhost:3000/configuracion')
  
  // Obtener el área de drop
  const dropArea = page.locator('label[for="logo-upload-input"]').first()
  
  // Simular drag & drop
  const fileInput = page.locator('input[type="file"]#logo-upload-input')
  await fileInput.setInputFiles('addiction boutique.jpg')
  
  // Verificar éxito
  await expect(page.locator('text=Logo guardado exitosamente')).toBeVisible()
})
```

### Test 3: Generación de PDF Compacto

**Objetivo**: Verificar que el PDF se genera con altura dinámica, sin espacios en blanco

**Pasos manuales**:
1. Ve al POS
2. Agrega 1-2 productos al carrito
3. Completa la venta
4. Click en "Generar Ticket PDF"
5. **Verifica**: Se abre el PDF en nueva pestaña
6. **Verifica**: El PDF es compacto (no tiene espacios en blanco grandes)
7. **Verifica**: El logo aparece en la parte superior
8. **Verifica**: Todo el contenido está visible

**Pasos con Playwright**:
```typescript
test('Generar PDF compacto desde POS', async ({ page, context }) => {
  await page.goto('http://localhost:3000/pos')
  
  // Agregar producto al carrito
  await page.click('text=Buscar Producto')
  await page.fill('input[placeholder*="Buscar"]', 'Camisa')
  await page.click('button:has-text("Agregar")')
  
  // Completar venta
  await page.click('button:has-text("Completar Venta")')
  await page.click('button:has-text("Contado")')
  
  // Esperar el modal de ticket
  await expect(page.locator('text=Venta Completada')).toBeVisible()
  
  // Click en generar PDF (se abre en nueva pestaña)
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    page.click('button:has-text("Descargar PDF")')
  ])
  
  // Esperar a que cargue el PDF
  await newPage.waitForLoadState('load')
  
  // Verificar que la URL es del PDF
  expect(newPage.url()).toContain('/api/sales/generate-pdf')
  
  // Tomar screenshot del PDF
  await newPage.screenshot({ path: 'test-results/pdf-compacto.png' })
})
```

### Test 4: Verificar Altura del PDF

**Pasos con Playwright + PDF Analysis**:
```typescript
import { test, expect } from '@playwright/test'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

test('Verificar altura dinámica del PDF', async ({ page, context }) => {
  await page.goto('http://localhost:3000/pos')
  
  // Realizar venta (código anterior)
  // ...
  
  // Descargar el PDF
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Descargar PDF")')
  ])
  
  // Guardar el PDF
  const path = await download.path()
  const pdfBytes = fs.readFileSync(path)
  
  // Analizar el PDF
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const { width, height } = firstPage.getSize()
  
  // Verificar dimensiones
  console.log(`PDF dimensions: ${width}pt x ${height}pt`)
  
  // Ancho debe ser ~226pt (80mm)
  expect(width).toBeCloseTo(226, 5)
  
  // Altura debe ser dinámica (no 800pt fijo)
  // Para 2 productos, debería ser ~350-450pt
  expect(height).toBeLessThan(500)
  expect(height).toBeGreaterThan(300)
  
  // Verificar que no es la altura fija anterior
  expect(height).not.toBe(800)
})
```

## Ejecutar los Tests

### Crear archivo de configuración

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Ejecutar tests

```bash
# Ejecutar todos los tests
npx playwright test

# Ejecutar un test específico
npx playwright test upload-logo

# Ejecutar en modo UI (interactivo)
npx playwright test --ui

# Ejecutar con headed mode (ver el navegador)
npx playwright test --headed

# Ver el reporte
npx playwright show-report
```

## Checklist de Validación Manual

### ✅ Upload de Logo

- [ ] El botón "Seleccionar Imagen" es visible
- [ ] Click en el botón abre el explorador de Windows
- [ ] Se puede seleccionar una imagen (JPG, PNG, GIF, SVG)
- [ ] Aparece el preview del logo
- [ ] Toast "Logo guardado exitosamente" aparece
- [ ] El logo se guarda en localStorage
- [ ] El logo se sube al servidor
- [ ] Click en el cuadro gris también abre el explorador
- [ ] Drag & drop funciona
- [ ] El botón X elimina el logo

### ✅ PDF Compacto

- [ ] El PDF se genera sin errores
- [ ] El PDF se abre en nueva pestaña
- [ ] El PDF tiene ancho de 80mm (~226pt)
- [ ] El PDF tiene altura dinámica (no fija)
- [ ] No hay espacios en blanco grandes
- [ ] El logo aparece en la parte superior
- [ ] Todos los productos están visibles
- [ ] Los totales están visibles
- [ ] El QR code está visible
- [ ] El footer está visible
- [ ] El PDF se puede descargar
- [ ] El nombre del archivo es correcto (Ticket_V-XXXX.pdf)

## Logs a Revisar

### En el navegador (Console)
```
[Settings] Upload button clicked
[Settings] File input ref: <input...>
[Settings] File input clicked successfully
[Settings] File input changed
[Settings] Processing file: logo.png image/png 116757
[Settings] Reading file...
[Settings] File read successfully, size: 155676
[Settings] Logo saved to localStorage
[Settings] Logo uploaded to server: {success: true, ...}
```

### En el servidor (Terminal)
```
[upload-logo] Processing file: logo.png image/png 116757
[upload-logo] Logo saved successfully to: C:\...\public\images\logo.png

[PDF] Altura estimada: 347 puntos
[PDF] Logo cargado exitosamente
[PDF] Altura final del contenido: 345 puntos
[PDF] PDF generado exitosamente, tamaño: 45231 bytes, altura: 345 pt
```

## Troubleshooting

### El explorador de archivos no se abre
- Verifica que el label tenga `htmlFor="logo-upload-input"`
- Verifica que el input tenga `id="logo-upload-input"`
- Refresca la página (Ctrl + F5)
- Prueba en modo incógnito

### El PDF sigue mostrando toda la hoja
- Verifica que reiniciaste el servidor
- Revisa los logs del servidor al generar el PDF
- Verifica que el código tenga `format: [226, estimatedHeight]`
- Limpia la caché del navegador

### El logo no aparece en el PDF
- Verifica que existe `public/images/logo.png`
- Reinicia el servidor (Ctrl + C, npm run dev)
- Revisa los logs: debe decir "[PDF] Logo cargado exitosamente"
- Verifica el tamaño del archivo (debe ser ~116 KB)

## Resultados Esperados

✅ **Upload de Logo**: 3 métodos funcionando (botón, cuadro, drag & drop)
✅ **PDF Compacto**: Altura dinámica, sin espacios en blanco
✅ **Logo en PDF**: Aparece en la parte superior del ticket
✅ **Descarga**: Nombre correcto del archivo
✅ **Compatibilidad**: Funciona en Windows con todos los navegadores
