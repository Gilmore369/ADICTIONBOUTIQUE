/**
 * Script de Pruebas Básicas del Sistema
 * 
 * Este script verifica que los archivos clave existen y están correctamente configurados
 * Para ejecutar: node test-system.js
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando pruebas del sistema...\n');

let passed = 0;
let failed = 0;

function test(name, condition, errorMsg) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    if (errorMsg) console.log(`   ${errorMsg}`);
    failed++;
  }
}

// ============================================================================
// 1. VERIFICAR ARCHIVOS CLAVE
// ============================================================================

console.log('📁 Verificando archivos clave...\n');

test(
  'PDF Generator existe',
  fs.existsSync('lib/pdf/generate-simple-receipt.ts'),
  'Archivo lib/pdf/generate-simple-receipt.ts no encontrado'
);

test(
  'API Route PDF existe',
  fs.existsSync('app/api/sales/[saleNumber]/pdf/route.ts'),
  'Archivo app/api/sales/[saleNumber]/pdf/route.ts no encontrado'
);

test(
  'Sales History View existe',
  fs.existsSync('components/sales/sales-history-view.tsx'),
  'Archivo components/sales/sales-history-view.tsx no encontrado'
);

test(
  'Returns Actions existe',
  fs.existsSync('actions/returns.ts'),
  'Archivo actions/returns.ts no encontrado'
);

test(
  'Returns Management View existe',
  fs.existsSync('components/returns/returns-management-view.tsx'),
  'Archivo components/returns/returns-management-view.tsx no encontrado'
);

test(
  'Sidebar actualizado existe',
  fs.existsSync('components/shared/sidebar.tsx'),
  'Archivo components/shared/sidebar.tsx no encontrado'
);

test(
  'Logo existe',
  fs.existsSync('public/images/logo.png'),
  'Logo no encontrado en public/images/logo.png'
);

// ============================================================================
// 2. VERIFICAR MIGRACIONES SQL
// ============================================================================

console.log('\n📊 Verificando migraciones SQL...\n');

test(
  'Migración Blacklist existe',
  fs.existsSync('supabase/migrations/20260306000001_add_blacklist_fields.sql'),
  'Migración de blacklist no encontrada'
);

test(
  'Migración Returns existe',
  fs.existsSync('supabase/migrations/20260307000000_create_returns_table.sql'),
  'Migración de returns no encontrada'
);

// ============================================================================
// 3. VERIFICAR CONTENIDO DE ARCHIVOS CLAVE
// ============================================================================

console.log('\n🔍 Verificando contenido de archivos...\n');

// Verificar que el PDF usa jsPDF
const pdfContent = fs.readFileSync('lib/pdf/generate-simple-receipt.ts', 'utf8');
test(
  'PDF usa jsPDF',
  pdfContent.includes('import jsPDF from'),
  'PDF no está usando jsPDF'
);

test(
  'PDF tiene configuración de tienda',
  pdfContent.includes('storeName') && pdfContent.includes('storeAddress'),
  'PDF no tiene configuración de tienda'
);

test(
  'PDF tiene QR code',
  pdfContent.includes('QRCode') && pdfContent.includes('60, 60'),
  'PDF no tiene QR code de 60x60pt'
);

test(
  'PDF tiene cuotas',
  pdfContent.includes('installments') && pdfContent.includes('CREDITO'),
  'PDF no tiene lógica de cuotas'
);

// Verificar Sidebar
const sidebarContent = fs.readFileSync('components/shared/sidebar.tsx', 'utf8');
test(
  'Sidebar tiene enlace a Historial de Ventas',
  sidebarContent.includes('/sales') && sidebarContent.includes('Historial de Ventas'),
  'Sidebar no tiene enlace a Historial de Ventas'
);

test(
  'Sidebar tiene enlace a Devoluciones',
  sidebarContent.includes('/returns') && sidebarContent.includes('Devoluciones'),
  'Sidebar no tiene enlace a Devoluciones'
);

test(
  'Sidebar tiene enlace a Lista Negra',
  sidebarContent.includes('/clients/blacklist') && sidebarContent.includes('Lista Negra'),
  'Sidebar no tiene enlace a Lista Negra'
);

// Verificar Returns Actions
const returnsContent = fs.readFileSync('actions/returns.ts', 'utf8');
test(
  'Returns tiene función getReturnsAction',
  returnsContent.includes('export async function getReturnsAction'),
  'Returns no tiene función getReturnsAction'
);

test(
  'Returns tiene función createReturnAction',
  returnsContent.includes('export async function createReturnAction'),
  'Returns no tiene función createReturnAction'
);

test(
  'Returns tiene función approveReturnAction',
  returnsContent.includes('export async function approveReturnAction'),
  'Returns no tiene función approveReturnAction'
);

test(
  'Returns tiene función checkReturnEligibilityAction',
  returnsContent.includes('export async function checkReturnEligibilityAction'),
  'Returns no tiene función checkReturnEligibilityAction'
);

// ============================================================================
// 4. VERIFICAR ESTRUCTURA DE DIRECTORIOS
// ============================================================================

console.log('\n📂 Verificando estructura de directorios...\n');

test(
  'Directorio actions existe',
  fs.existsSync('actions'),
  'Directorio actions no encontrado'
);

test(
  'Directorio components/sales existe',
  fs.existsSync('components/sales'),
  'Directorio components/sales no encontrado'
);

test(
  'Directorio components/returns existe',
  fs.existsSync('components/returns'),
  'Directorio components/returns no encontrado'
);

test(
  'Directorio components/clients existe',
  fs.existsSync('components/clients'),
  'Directorio components/clients no encontrado'
);

test(
  'Directorio lib/pdf existe',
  fs.existsSync('lib/pdf'),
  'Directorio lib/pdf no encontrado'
);

test(
  'Directorio public/images existe',
  fs.existsSync('public/images'),
  'Directorio public/images no encontrado'
);

// ============================================================================
// 5. VERIFICAR PÁGINAS
// ============================================================================

console.log('\n📄 Verificando páginas...\n');

test(
  'Página de Historial de Ventas existe',
  fs.existsSync('app/(auth)/sales/page.tsx'),
  'Página app/(auth)/sales/page.tsx no encontrada'
);

test(
  'Página de Devoluciones existe',
  fs.existsSync('app/(auth)/returns/page.tsx'),
  'Página app/(auth)/returns/page.tsx no encontrada'
);

test(
  'Página de Lista Negra existe',
  fs.existsSync('app/(auth)/clients/blacklist/page.tsx'),
  'Página app/(auth)/clients/blacklist/page.tsx no encontrada'
);

// ============================================================================
// RESUMEN
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN DE PRUEBAS');
console.log('='.repeat(60));
console.log(`✅ Pruebas exitosas: ${passed}`);
console.log(`❌ Pruebas fallidas: ${failed}`);
console.log(`📈 Total: ${passed + failed}`);
console.log(`🎯 Porcentaje de éxito: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

if (failed === 0) {
  console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');
  console.log('\n📝 Próximos pasos:');
  console.log('   1. Ejecutar migraciones SQL en Supabase');
  console.log('   2. Verificar que el servidor esté corriendo (npm run dev)');
  console.log('   3. Probar manualmente usando MANUAL_TESTING_GUIDE.md');
  process.exit(0);
} else {
  console.log('\n⚠️  Algunas pruebas fallaron. Revisa los errores arriba.');
  console.log('\n📝 Acciones recomendadas:');
  console.log('   1. Verificar que todos los archivos existen');
  console.log('   2. Revisar el contenido de los archivos con errores');
  console.log('   3. Ejecutar npm install si faltan dependencias');
  process.exit(1);
}
