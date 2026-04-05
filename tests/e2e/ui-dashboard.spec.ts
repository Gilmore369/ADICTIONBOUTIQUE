/**
 * Dashboard visual validation — screenshot test
 * Uses storageState if available, otherwise logs in fresh.
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_FILE = path.join(__dirname, '.auth/user.json')
const BASE = 'http://127.0.0.1:3000'

test.describe('Dashboard — validación visual', () => {

  test.beforeEach(async ({ page, context }) => {
    // Load auth state if it exists and has cookies
    const authExists = fs.existsSync(AUTH_FILE)
    if (authExists) {
      try {
        const raw = fs.readFileSync(AUTH_FILE, 'utf-8')
        const parsed = JSON.parse(raw)
        if (parsed.cookies?.length > 0) {
          await context.addCookies(parsed.cookies)
        }
      } catch { /* ignore */ }
    }
  })

  test('dashboard carga sin errores JS', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 })

    // If redirected to login (no auth), just check login page loads fine
    if (page.url().includes('/login')) {
      await expect(page.locator('input[type="email"]')).toBeVisible()
      console.log('ℹ️  Sin sesión activa — se verificó que login carga correctamente')
      return
    }

    // Authenticated: check key dashboard elements
    await expect(page.locator('h1')).toContainText('Dashboard')

    // KPI section (at least one value card should be visible)
    const kpiLinks = page.locator('a[href="/sales?period=TODAY"], a[href="/sales?period=MONTH"], a[href="/collections/history?period=MONTH"]')
    await expect(kpiLinks.first()).toBeVisible({ timeout: 10000 })

    // Main chart section (renamed in redesign to "Ventas, Contado y Crédito")
    const mainChart = page.locator('text=Ventas, Contado y Crédito')
    await expect(mainChart).toBeVisible({ timeout: 8000 })

    // Range selector
    await expect(page.locator('button:has-text("7D")')).toBeVisible()
    await expect(page.locator('button:has-text("30D")')).toBeVisible()

    // Top Productos section
    await expect(page.locator('text=Top Productos')).toBeVisible()

    // Contado vs Crédito
    await expect(page.locator('text=Contado vs Crédito')).toBeVisible()

    // Heatmap (renamed in redesign)
    await expect(page.locator('text=Intensidad de Ventas por Hora')).toBeVisible()

    // Funnel
    await expect(page.locator('text=Embudo de Clientes')).toBeVisible()

    // Location
    await expect(page.locator('text=Clientes por Distrito')).toBeVisible()

    // Inventory
    await expect(page.locator('text=Rotación de Inventario')).toBeVisible()

    // Recent sales
    await expect(page.locator('text=Ventas Recientes')).toBeVisible()

    // No JS errors
    const criticalErrors = errors.filter(e =>
      !e.includes('hydration') &&
      !e.includes('Warning') &&
      !e.includes('DevTools')
    )
    expect(criticalErrors, `Errores JS: ${criticalErrors.join('\n')}`).toHaveLength(0)

    // Wait for Recharts to finish painting (AnimationDuration + repaint)
    await page.waitForTimeout(2000)

    // Verify main chart SVG rendered (Recharts creates <svg> elements)
    const svgCount = await page.locator('svg').count()
    expect(svgCount).toBeGreaterThan(3) // at least sparklines + main chart + pie

    await page.screenshot({ path: 'tests/e2e/screenshots/dashboard-full.png', fullPage: true })
    console.log(`✅ Screenshot guardado — ${svgCount} SVGs renderizados`)
  })

  test('range selector 7D/30D funciona', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 })
    if (page.url().includes('/login')) { test.skip() }

    const btn7D  = page.locator('button:has-text("7D")')
    const btn30D = page.locator('button:has-text("30D")')

    // Click 7D → ambos botones deben seguir visibles (sin crash/navegación)
    await btn7D.click()
    await page.waitForTimeout(400)
    await expect(btn7D).toBeVisible({ timeout: 5000 })
    await expect(btn30D).toBeVisible({ timeout: 5000 })

    // Click 30D
    await btn30D.click()
    await page.waitForTimeout(400)
    await expect(btn7D).toBeVisible({ timeout: 5000 })
    await expect(btn30D).toBeVisible({ timeout: 5000 })
  })

  test('heatmap tiene 7 filas de días', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 })
    if (page.url().includes('/login')) { test.skip() }

    // Heatmap days: Lun Mar Mié Jue Vie Sáb Dom
    for (const day of ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']) {
      await expect(page.locator(`text=${day}`).first()).toBeVisible()
    }
  })

  test('KPI cards tienen enlaces navegables', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 })
    if (page.url().includes('/login')) { test.skip() }

    // Check key hrefs exist
    const links = [
      '/sales?period=TODAY',
      '/sales?period=MONTH',
      '/collections/history?period=MONTH',
      '/inventory/stock',
      '/clients',
    ]
    for (const href of links) {
      const link = page.locator(`a[href="${href}"]`).first()
      await expect(link).toBeVisible()
    }
  })

  test('ventas recientes se muestran', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 })
    if (page.url().includes('/login')) { test.skip() }

    const recentSection = page.locator('text=Ventas Recientes')
    await expect(recentSection).toBeVisible()

    // Either shows sales or "no hay ventas"
    const hasSales = page.locator('text=No hay ventas registradas')
    const hasTable = page.locator('a[href="/pos"]').last()
    await expect(hasTable.or(hasSales)).toBeVisible()
  })
})
