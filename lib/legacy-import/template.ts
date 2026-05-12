/**
 * Generates an Excel template for bulk legacy debt import.
 *
 * Hojas incluidas:
 *   1. Instrucciones — cómo llenar
 *   2. Plantilla — fila ejemplo + columnas, lista para llenar
 *   3. Diccionario — explicación de cada columna
 */

import * as XLSX from 'xlsx-js-style'

export function generateLegacyImportTemplate(): Blob {
  const wb = XLSX.utils.book_new()

  // ── Hoja 1: Instrucciones ──────────────────────────────────────────────
  const instr = XLSX.utils.aoa_to_sheet([
    ['ADICTION BOUTIQUE'],
    ['Plantilla de importación masiva de deudas (legacy)'],
    [],
    ['Cómo usar esta plantilla:'],
    ['  1. Llena la hoja "Plantilla" con un cliente por fila.'],
    ['  2. Las columnas marcadas con * son obligatorias.'],
    ['  3. Las fechas deben tener formato AAAA-MM-DD (ej: 2026-05-09).'],
    ['  4. Los montos pueden tener punto o coma decimal (ej: 1234.50 o 1234,50).'],
    ['  5. Si un cliente ya existe en el sistema (mismo DNI), se le agregará la deuda.'],
    ['  6. Si NO existe, se creará automáticamente.'],
    ['  7. Para registrar pagos individuales, usa la columna "historial_pagos":'],
    ['     formato simple: monto:fecha;monto:fecha     ej: 100:2024-05-10;200:2024-06-15'],
    ['     formato detallado: monto | fecha | metodo | nota     ej: 100 | 10/05/2024 | EFECTIVO | Pago inicial'],
    ['  8. Si llenas historial_pagos, monto_pagado puede quedar vacio: el sistema calcula la suma.'],
    ['  9. Sube el archivo en la sección "Importar Deudas" del sistema.'],
    [],
    ['Validaciones automáticas:'],
    ['  • DNI duplicado en el archivo → error en la fila'],
    ['  • monto_pagado mayor al total → error'],
    ['  • Suma de pagos históricos ≠ monto_pagado → error'],
    ['  • Fechas con formato incorrecto → error'],
    [],
    ['IMPORTANTE: Antes de importar, el sistema te muestra un PREVIEW.'],
    ['Solo si confirmas, las deudas quedan registradas en la base de datos.'],
    ['Cada lote queda auditado: puedes revertir o consultar quién importó qué.'],
  ])
  instr['!cols'] = [{ wch: 80 }]
  if (instr['A1']) instr['A1'].s = { font: { bold: true, sz: 14 } }
  if (instr['A2']) instr['A2'].s = { font: { italic: true, color: { rgb: 'FF6B7280' } } }
  XLSX.utils.book_append_sheet(wb, instr, '📋 Instrucciones')

  // ── Hoja 2: Plantilla con fila ejemplo ─────────────────────────────────
  const headers = [
    'dni*',
    'nombre*',
    'email',
    'telefono',
    'direccion',
    'distrito',
    'cumpleaños',
    'descripcion_compra*',
    'fecha_compra*',
    'monto_total*',
    'monto_pagado',
    'fecha_vencimiento',
    'historial_pagos',
    'notas',
  ]
  const exampleRows = [
    [
      '12345678',
      'María García López',
      'maria.garcia@gmail.com',
      '987654321',
      'Av. España 123',
      'Trujillo',
      '1990-03-15',
      'Casaca de cuero negra L + 2 polos',
      '2024-08-15',
      450.00,
      150.00,
      '2026-06-30',
      '50 | 15/09/2024 | EFECTIVO | Pago inicial;100 | 10/12/2024 | YAPE | Segundo abono',
      'Cliente del sistema anterior, paga a plazos',
    ],
    [
      '87654321',
      'Carlos Mendoza',
      'cmendoza@hotmail.com',
      '912345678',
      'Jr. Bolognesi 456',
      'La Esperanza',
      '',
      'Conjunto deportivo Nike + zapatillas',
      '2024-12-01',
      650.00,
      0,
      '',
      '',
      'No ha pagado nada aún',
    ],
    [
      '11223344',
      'Ana Sofía Torres',
      '',
      '999888777',
      'Calle Las Flores 789',
      'Víctor Larco',
      '1985-07-22',
      'Vestido de fiesta',
      '2025-02-14',
      280.00,
      280.00,
      '',
      '280:2025-02-14:EFECTIVO',
      'Pagó al contado en sistema anterior — solo registrar histórico',
    ],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows])

  // Anchos
  ws['!cols'] = [
    { wch: 12 }, // dni
    { wch: 28 }, // nombre
    { wch: 28 }, // email
    { wch: 14 }, // telefono
    { wch: 28 }, // direccion
    { wch: 14 }, // distrito
    { wch: 12 }, // cumpleaños
    { wch: 36 }, // descripcion
    { wch: 13 }, // fecha_compra
    { wch: 12 }, // monto_total
    { wch: 12 }, // monto_pagado
    { wch: 13 }, // fecha_venc
    { wch: 40 }, // historial
    { wch: 30 }, // notas
  ]

  // Header style
  for (let c = 0; c < headers.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[ref]) {
      ws[ref].s = {
        font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        fill: { fgColor: { rgb: 'FF10B981' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
    }
  }

  // Format moneda en col 9 (monto_total) y 10 (monto_pagado) para todas las filas
  for (let row = 1; row <= exampleRows.length; row++) {
    const totalRef = XLSX.utils.encode_cell({ r: row, c: 9 })
    const pagadoRef = XLSX.utils.encode_cell({ r: row, c: 10 })
    if (ws[totalRef]) ws[totalRef].z = '"S/" #,##0.00'
    if (ws[pagadoRef]) ws[pagadoRef].z = '"S/" #,##0.00'
  }

  // Pintar filas ejemplo en gris claro para indicar que se pueden borrar
  for (let row = 1; row <= exampleRows.length; row++) {
    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: row, c })
      if (ws[ref]) {
        ws[ref].s = {
          ...(ws[ref].s || {}),
          fill: { fgColor: { rgb: 'FFF9FAFB' } },
          font: { italic: true, color: { rgb: 'FF6B7280' } },
        }
      }
    }
  }

  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 1000, c: headers.length - 1 } }) }

  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla')

  // ── Hoja 3: Diccionario de columnas ────────────────────────────────────
  const dict = XLSX.utils.aoa_to_sheet([
    ['Columna', 'Obligatoria', 'Tipo', 'Descripción', 'Ejemplo'],
    ['dni', 'Sí', 'Texto', 'Documento de identidad. Si ya existe, se reutiliza el cliente.', '12345678'],
    ['nombre', 'Sí', 'Texto', 'Nombre completo del cliente.', 'María García López'],
    ['email', 'No', 'Texto', 'Correo electrónico. Se usa para enviar notificaciones de cobro.', 'maria@gmail.com'],
    ['telefono', 'No', 'Texto', 'Número de contacto.', '987654321'],
    ['direccion', 'No', 'Texto', 'Dirección de domicilio.', 'Av. España 123'],
    ['distrito', 'No', 'Texto', 'Distrito (se concatena en dirección).', 'Trujillo'],
    ['cumpleaños', 'No', 'Fecha', 'Fecha de nacimiento (AAAA-MM-DD).', '1990-03-15'],
    ['descripcion_compra', 'Sí', 'Texto', 'Qué compró el cliente que generó esta deuda.', 'Casaca de cuero negra L'],
    ['fecha_compra', 'Sí', 'Fecha', 'Cuándo se hizo la compra original (AAAA-MM-DD).', '2024-08-15'],
    ['monto_total', 'Sí', 'Número', 'Monto total de la compra (deuda original).', '450.00'],
    ['monto_pagado', 'No', 'Número', 'Total ya abonado a la fecha. Default: 0.', '150.00'],
    ['fecha_vencimiento', 'No', 'Fecha', 'Fecha pactada para terminar de pagar.', '2026-06-30'],
    ['historial_pagos', 'No', 'Texto', 'Lista de pagos individuales. Formatos: monto:fecha:metodo:nota o monto | fecha | metodo | nota. Acepta YYYY-MM-DD o DD/MM/YYYY.', '50 | 15/09/2024 | EFECTIVO | Pago inicial;100 | 10/12/2024 | YAPE | Segundo abono'],
    ['notas', 'No', 'Texto', 'Comentarios adicionales sobre el cliente o la deuda.', 'Cliente del sistema anterior'],
  ])
  dict['!cols'] = [
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 60 },
    { wch: 36 },
  ]
  for (let c = 0; c < 5; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c })
    if (dict[ref]) {
      dict[ref].s = {
        font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        fill: { fgColor: { rgb: 'FF374151' } },
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, dict, '📖 Diccionario')

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
