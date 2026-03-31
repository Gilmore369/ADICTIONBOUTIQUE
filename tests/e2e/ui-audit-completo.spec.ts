/**
 * AUDITORÍA COMPLETA — Adiction Boutique ERP
 * Recorre todas las secciones, documenta estado, botones y errores.
 */

import { test, expect } from '@playwright/test'

const BASE = 'https://adictionboutique.agsys.es'
const RESULTS: Record<string, any> = {}

async function auditPage(page: any, path: string, label: string) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1500)

    const url = page.url()
    const title = await page.locator('h1, h2').first().textContent({ timeout: 5000 }).catch(() => '—')
    const errorEl = await page.locator('.error, [class*="error-message"], [class*="alert-error"]').count()
    const buttons = await page.locator('button:visible').allTextContents()
    const links = await page.locator('a[href]:visible').count()
    const tableRows = await page.locator('table tbody tr').count()
    const forms = await page.locator('form, [role="form"]').count()
    const hasContent = await page.locator('main, [role="main"]').count() > 0

    // Detectar si fue redirigido (ej: 404 o login)
    const redirected = !url.includes(path.split('?')[0])
    const status = redirected ? '⚠️ REDIRIGIDO' : (errorEl > 0 ? '⚠️ CON ERRORES' : '✅ OK')

    const btnFiltered = [...new Set(buttons.map(b => b.trim()).filter(b => b && b.length < 40))]

    RESULTS[label] = {
      status,
      title: title?.trim(),
      url,
      buttons: btnFiltered.slice(0, 15),
      tableRows,
      forms,
      links,
    }

    console.log(`\n${status} [${label}] → ${title?.trim()}`)
    console.log(`   URL: ${url}`)
    if (tableRows > 0) console.log(`   Filas en tabla: ${tableRows}`)
    if (btnFiltered.length > 0) console.log(`   Botones: ${btnFiltered.join(' | ')}`)

    await page.screenshot({ path: `tests/screenshots/audit-${label.replace(/[^a-z0-9]/gi, '-')}.png`, fullPage: false })
    return RESULTS[label]
  } catch (e: any) {
    RESULTS[label] = { status: '❌ ERROR', error: e.message }
    console.log(`❌ ERROR [${label}]: ${e.message}`)
    return RESULTS[label]
  }
}

test.setTimeout(300000)

test('Auditoría completa del ERP', async ({ page }) => {
  page.setDefaultTimeout(15000)

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  await auditPage(page, '/dashboard', 'dashboard')
  await auditPage(page, '/dashboard?store=MUJERES', 'dashboard-mujeres')
  await auditPage(page, '/dashboard?store=HOMBRES', 'dashboard-hombres')

  // ── POS ──────────────────────────────────────────────────────────────────
  await auditPage(page, '/pos', 'pos')

  // ── VENTAS ───────────────────────────────────────────────────────────────
  await auditPage(page, '/sales', 'historial-ventas')
  await auditPage(page, '/returns', 'devoluciones')

  // ── CAJA ─────────────────────────────────────────────────────────────────
  await auditPage(page, '/cash', 'caja')

  // ── DEUDA Y COBRANZAS ────────────────────────────────────────────────────
  await auditPage(page, '/debt', 'deuda')
  await auditPage(page, '/debt/plans', 'deuda-planes')
  await auditPage(page, '/collections', 'cobranzas')
  await auditPage(page, '/collections/actions', 'cobranzas-acciones')

  // ── AGENDA ───────────────────────────────────────────────────────────────
  await auditPage(page, '/agenda', 'agenda')

  // ── CLIENTES ─────────────────────────────────────────────────────────────
  await auditPage(page, '/clients', 'clientes-lista')
  await auditPage(page, '/clients/dashboard', 'clientes-dashboard')
  await auditPage(page, '/clients/blacklist', 'clientes-blacklist')
  await auditPage(page, '/map', 'mapa')

  // ── INVENTARIO ───────────────────────────────────────────────────────────
  await auditPage(page, '/inventory/stock', 'inventario-stock')
  await auditPage(page, '/inventory/movements', 'inventario-movimientos')
  await auditPage(page, '/inventory/bulk-entry', 'inventario-ingreso-masivo')

  // ── CATÁLOGOS ────────────────────────────────────────────────────────────
  await auditPage(page, '/catalogs/visual', 'catalogo-visual')
  await auditPage(page, '/catalogs/products', 'productos')
  await auditPage(page, '/catalogs/lines', 'lineas')
  await auditPage(page, '/catalogs/categories', 'categorias')
  await auditPage(page, '/catalogs/brands', 'marcas')
  await auditPage(page, '/catalogs/sizes', 'tallas')
  await auditPage(page, '/catalogs/suppliers', 'proveedores')

  // ── REPORTES ─────────────────────────────────────────────────────────────
  await auditPage(page, '/reports', 'reportes')

  // ── PROBAR CREAR PRODUCTO SIMPLE ─────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════')
  console.log('PRUEBA: Crear Producto Simple')
  await page.goto(`${BASE}/catalogs/products`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const simpleBtn = page.locator('button:has-text("Producto Simple")')
  if (await simpleBtn.count() > 0) {
    await simpleBtn.click()
    await page.waitForTimeout(2000)
    const modal = await page.locator('[role="dialog"], .modal, [class*="modal"]').count()
    const formFields = await page.locator('input:visible, select:visible, textarea:visible').allTextContents()
    const inputPlaceholders = await page.locator('input:visible').evaluateAll((els: HTMLInputElement[]) => els.map(e => e.placeholder || e.name).filter(Boolean))
    console.log(`Modal abierto: ${modal > 0 ? '✅' : '❌'}`)
    console.log(`Campos del formulario: ${inputPlaceholders.join(' | ')}`)
    await page.screenshot({ path: 'tests/screenshots/audit-crear-producto-simple.png', fullPage: false })
  }

  // ── PROBAR CREAR PRODUCTO MÚLTIPLES TALLAS ───────────────────────────────
  console.log('\nPRUEBA: Crear Producto Múltiples Tallas')
  const multiBtn = page.locator('button:has-text("Múltiples Tallas")')
  if (await multiBtn.count() > 0) {
    await multiBtn.click()
    await page.waitForTimeout(2000)
    const modal = await page.locator('[role="dialog"], .modal, [class*="modal"]').count()
    const inputPlaceholders = await page.locator('input:visible').evaluateAll((els: HTMLInputElement[]) => els.map(e => e.placeholder || e.name).filter(Boolean))
    console.log(`Modal abierto: ${modal > 0 ? '✅' : '❌'}`)
    console.log(`Campos: ${inputPlaceholders.join(' | ')}`)
    await page.screenshot({ path: 'tests/screenshots/audit-crear-producto-multiple.png', fullPage: false })
  }

  // ── DEVOLUCIONES: VERIFICAR FLUJO ────────────────────────────────────────
  console.log('\nPRUEBA: Devoluciones — flujo de reversión')
  await page.goto(`${BASE}/returns`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const returnRows = await page.locator('table tbody tr').count()
  console.log(`Devoluciones registradas: ${returnRows}`)

  if (returnRows > 0) {
    // Ver si tiene columnas de stock y monto
    const headers = await page.locator('table thead th').allTextContents()
    console.log(`Columnas tabla devoluciones: ${headers.join(' | ')}`)

    // Click en primera fila para ver detalle
    await page.locator('table tbody tr').first().click().catch(() => {})
    await page.waitForTimeout(1500)
    const detailVisible = await page.locator('[role="dialog"], [class*="detail"], [class*="modal"]').count()
    console.log(`Detalle devolución: ${detailVisible > 0 ? '✅ Abre panel' : '⚠️ No abre panel'}`)
    await page.screenshot({ path: 'tests/screenshots/audit-devolucion-detalle.png', fullPage: false })
  }

  // ── RESUMEN FINAL ─────────────────────────────────────────────────────────
  console.log('\n\n══════════════════ RESUMEN AUDITORÍA ══════════════════')
  const ok = Object.entries(RESULTS).filter(([, v]) => v.status?.startsWith('✅'))
  const warn = Object.entries(RESULTS).filter(([, v]) => v.status?.startsWith('⚠️'))
  const err = Object.entries(RESULTS).filter(([, v]) => v.status?.startsWith('❌'))

  console.log(`\n✅ OK (${ok.length}): ${ok.map(([k]) => k).join(', ')}`)
  console.log(`⚠️  ADVERTENCIAS (${warn.length}): ${warn.map(([k, v]) => `${k}→${v.url}`).join(', ')}`)
  console.log(`❌ ERRORES (${err.length}): ${err.map(([k, v]) => `${k}: ${v.error}`).join(', ')}`)

  expect(err.length).toBe(0)
})
