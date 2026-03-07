/**
 * Test: Generar PDF con Logo de ADICTION BOUTIQUE
 * 
 * Este script prueba la generación del PDF con el logo incluido
 */

const fs = require('fs');
const path = require('path');

async function testPDFWithLogo() {
  console.log('=== PRUEBA: PDF CON LOGO ===\n');

  // Verificar que el logo existe
  const logoPath = path.join(process.cwd(), 'public', 'images', 'logo.png');
  console.log('1. Verificando logo...');
  console.log('   Ruta:', logoPath);
  
  if (fs.existsSync(logoPath)) {
    const stats = fs.statSync(logoPath);
    console.log('   ✅ Logo encontrado');
    console.log('   Tamaño:', (stats.size / 1024).toFixed(2), 'KB');
  } else {
    console.log('   ❌ Logo NO encontrado');
    return;
  }

  console.log('\n2. Generando PDF de prueba...');

  const testData = {
    saleNumber: 'V-TEST-LOGO',
    date: new Date().toISOString(),
    items: [
      {
        quantity: 1,
        name: 'Producto de Prueba',
        unit_price: 100.00,
        subtotal: 100.00
      }
    ],
    subtotal: 100.00,
    discount: 0,
    total: 100.00,
    paymentType: 'CONTADO',
    clientName: 'Cliente de Prueba',
    storeName: 'ADICTION BOUTIQUE',
    storeAddress: 'Av. Principal 123, Trujillo',
    storePhone: '(044) 555-9999',
    storeRuc: '20123456789',
    ticketUrl: 'http://localhost:3000/tickets/V-TEST-LOGO',
    method: 'jspdf'
  };

  try {
    const response = await fetch('http://localhost:3000/api/sales/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('   ❌ Error en la respuesta:', errorData);
      return;
    }

    const contentType = response.headers.get('content-type');
    console.log('   Content-Type:', contentType);

    const buffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(buffer);
    
    console.log('   ✅ PDF generado');
    console.log('   Tamaño:', (pdfBuffer.length / 1024).toFixed(2), 'KB');

    // Guardar PDF
    const outputPath = path.join(process.cwd(), 'Ticket-TEST-LOGO.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log('   ✅ PDF guardado:', outputPath);

    // Verificar contenido del PDF
    const pdfContent = pdfBuffer.toString('latin1');
    const hasLogo = pdfContent.includes('/Image') || pdfContent.includes('PNG');
    const hasQR = pdfContent.includes('/Image') || pdfContent.includes('PNG');
    
    console.log('\n3. Verificación de contenido:');
    console.log('   Logo incluido:', hasLogo ? '✅' : '❌');
    console.log('   QR incluido:', hasQR ? '✅' : '❌');
    console.log('   Texto ADICTION:', pdfContent.includes('ADICTION') ? '✅' : '❌');

    console.log('\n=== PRUEBA COMPLETADA ===');
    console.log('Abre el archivo Ticket-TEST-LOGO.pdf para verificar visualmente');

  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
}

testPDFWithLogo();
