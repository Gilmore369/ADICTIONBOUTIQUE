/**
 * Script de prueba para verificar la generación de PDF
 * Ejecutar con: node test-pdf-generation.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function testPDFGeneration() {
  console.log('🚀 Iniciando prueba de generación de PDF...');
  
  let browser = null;
  try {
    // Lanzar navegador
    console.log('📦 Lanzando navegador...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // HTML de prueba simple
    const testHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test PDF</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1a1a1a;
      background: white;
    }
    .container {
      width: 80mm;
      margin: 0 auto;
      padding: 8mm;
      background: white;
    }
    .header {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 2px solid #1a1a1a;
    }
    .store-name {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="store-name">ADICTION BOUTIQUE</div>
      <div>Av. Principal 123, Trujillo</div>
      <div>Tel: (044) 555-9999</div>
      <div>RUC: 20123456789</div>
    </div>
    
    <div style="text-align: center; margin: 20px 0;">
      <h2>TICKET DE PRUEBA</h2>
      <p>V-TEST-001</p>
      <p>Fecha: ${new Date().toLocaleString('es-PE')}</p>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead style="background: #1a1a1a; color: white;">
        <tr>
          <th style="padding: 6px; text-align: left;">CANT</th>
          <th style="padding: 6px; text-align: left;">PRODUCTO</th>
          <th style="padding: 6px; text-align: right;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 6px; border-bottom: 1px solid #e5e7eb;">2</td>
          <td style="padding: 6px; border-bottom: 1px solid #e5e7eb;">Producto de Prueba</td>
          <td style="padding: 6px; border-bottom: 1px solid #e5e7eb; text-align: right;">S/ 100.00</td>
        </tr>
      </tbody>
    </table>
    
    <div style="border-top: 2px solid #1a1a1a; padding-top: 8px; margin-top: 20px;">
      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700;">
        <span>TOTAL:</span>
        <span>S/ 100.00</span>
      </div>
    </div>
    
    <div style="text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px dashed #d1d5db;">
      <p>¡Gracias por su preferencia!</p>
    </div>
  </div>
</body>
</html>
    `;

    console.log('📄 Configurando contenido HTML...');
    await page.setViewport({
      width: 302, // 80mm en pixels
      height: 1200
    });

    await page.setContent(testHTML, { 
      waitUntil: ['networkidle0', 'load'],
      timeout: 30000
    });

    console.log('🖨️ Generando PDF...');
    const pdfBuffer = await page.pdf({
      width: '80mm',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      },
      preferCSSPageSize: false
    });

    // Guardar PDF
    const filename = 'test-ticket.pdf';
    fs.writeFileSync(filename, pdfBuffer);
    
    console.log('✅ PDF generado exitosamente!');
    console.log(`📁 Archivo guardado: ${filename}`);
    console.log(`📊 Tamaño: ${pdfBuffer.length} bytes`);
    
    await browser.close();
    
    console.log('\n✨ Prueba completada exitosamente!');
    console.log(`👉 Abre el archivo "${filename}" para verificar el contenido`);
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

testPDFGeneration();
