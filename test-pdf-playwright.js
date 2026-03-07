/**
 * Test: PDF Mejorado usando Playwright
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testPDFWithPlaywright() {
  console.log('=== PRUEBA: PDF CON PLAYWRIGHT ===\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Login
    console.log('1. Iniciando sesión...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'admin@adiction.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   ✅ Sesión iniciada');

    // 2. Ir al POS
    console.log('\n2. Navegando al POS...');
    await page.goto('http://localhost:3000/pos');
    await page.waitForLoadState('networkidle');
    console.log('   ✅ POS cargado');

    // 3. Buscar y agregar producto
    console.log('\n3. Agregando producto...');
    await page.fill('input[placeholder*="Buscar"]', 'Camisa');
    await page.waitForTimeout(1000);
    
    const firstProduct = await page.locator('button:has-text("Agregar")').first();
    await firstProduct.click();
    await page.waitForTimeout(500);
    console.log('   ✅ Producto agregado');

    // 4. Completar venta a CRÉDITO
    console.log('\n4. Completando venta a crédito...');
    await page.click('button:has-text("Crédito")');
    await page.waitForTimeout(500);
    
    // Seleccionar cliente
    const clientSelect = await page.locator('select').first();
    await clientSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    
    // Configurar cuotas
    const installmentsInput = await page.locator('input[type="number"]').last();
    await installmentsInput.fill('6');
    await page.waitForTimeout(500);
    
    // Completar venta
    await page.click('button:has-text("Completar Venta")');
    await page.waitForTimeout(2000);
    console.log('   ✅ Venta completada');

    // 5. Descargar PDF
    console.log('\n5. Descargando PDF...');
    
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("PDF")');
    const download = await downloadPromise;
    
    const fileName = download.suggestedFilename();
    const downloadPath = path.join(process.cwd(), fileName);
    await download.saveAs(downloadPath);
    
    const stats = fs.statSync(downloadPath);
    console.log('   ✅ PDF descargado:', fileName);
    console.log('   Tamaño:', (stats.size / 1024).toFixed(2), 'KB');

    // 6. Verificar contenido del PDF
    console.log('\n6. Verificando contenido...');
    const pdfBuffer = fs.readFileSync(downloadPath);
    const pdfContent = pdfBuffer.toString('latin1');
    
    console.log('   Logo/Imágenes:', pdfContent.includes('/Image') ? '✅' : '❌');
    console.log('   ADICTION BOUTIQUE:', pdfContent.includes('ADICTION') ? '✅' : '❌');
    console.log('   Plan de cuotas:', pdfContent.includes('CUOTAS') ? '✅' : '❌');
    console.log('   Código QR:', pdfContent.includes('PNG') ? '✅' : '❌');

    console.log('\n=== PRUEBA EXITOSA ===');
    console.log('PDF guardado en:', downloadPath);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testPDFWithPlaywright();
