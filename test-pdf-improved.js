/**
 * Test: PDF Mejorado con altura dinámica
 */

const fs = require('fs');
const path = require('path');

async function testImprovedPDF() {
  console.log('=== PRUEBA: PDF MEJORADO ===\n');

  // Datos de prueba con crédito y cuotas (caso más complejo)
  const testData = {
    saleNumber: 'V-0047',
    date: new Date().toISOString(),
    items: [
      {
        quantity: 1,
        name: 'Camisa Formal - L - Blanco',
        unit_price: 95.00,
        subtotal: 95.00
      }
    ],
    subtotal: 95.00,
    discount: 0,
    total: 95.00,
    paymentType: 'CREDITO',
    clientName: 'Juan Pérez García',
    storeName: 'ADICTION BOUTIQUE',
    storeAddress: 'Av. Principal 123, Trujillo',
    storePhone: '(044) 555-9999',
    storeRuc: '20123456789',
    installments: 6,
    ticketUrl: 'http://localhost:3000/tickets/V-0047',
    method: 'jspdf'
  };

  try {
    console.log('1. Generando PDF con crédito y 6 cuotas...');
    
    const response = await fetch('http://localhost:3000/api/sales/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('   ❌ Error:', errorData);
      return;
    }

    const buffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(buffer);
    
    console.log('   ✅ PDF generado');
    console.log('   Tamaño:', (pdfBuffer.length / 1024).toFixed(2), 'KB');

    // Guardar PDF
    const outputPath = path.join(process.cwd(), 'Ticket-V-0047-Mejorado.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log('   ✅ PDF guardado:', outputPath);

    console.log('\n2. Verificación de contenido:');
    const pdfContent = pdfBuffer.toString('latin1');
    console.log('   Logo:', pdfContent.includes('/Image') ? '✅' : '❌');
    console.log('   ADICTION BOUTIQUE:', pdfContent.includes('ADICTION') ? '✅' : '❌');
    console.log('   Número de ticket:', pdfContent.includes('V-0047') ? '✅' : '❌');
    console.log('   Cliente:', pdfContent.includes('Juan') ? '✅' : '❌');
    console.log('   Plan de cuotas:', pdfContent.includes('CUOTAS') ? '✅' : '❌');

    console.log('\n=== PRUEBA COMPLETADA ===');
    console.log('Abre Ticket-V-0047-Mejorado.pdf para verificar');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testImprovedPDF();
