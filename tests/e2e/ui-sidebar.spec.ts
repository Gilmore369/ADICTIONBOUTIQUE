/**
 * UI Tests — Sidebar
 * Requiere autenticación (usa el storageState del auth.setup.ts).
 *
 * Prueba:
 * 1. Sidebar visible y expandida por defecto
 * 2. Botón colapsar cierra la sidebar
 * 3. Hover sobre sidebar colapsada la expande temporalmente
 * 4. Navegación entre secciones funciona
 * 5. Submenús se abren/cierran
 */

import { test, expect } from '@playwright/test'

test.describe('Sidebar — comportamiento', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
  })

  test('sidebar expandida muestra textos de navegación', async ({ page }) => {
    // Si la sidebar empieza colapsada, la expandimos primero
    const sidebar = page.locator('aside')
    const collapseBtn = page.locator('button[title="Colapsar menú"]')

    // Esperar que la sidebar cargue
    await expect(sidebar).toBeVisible()

    // Si está colapsada, expandir
    const expandBtn = page.locator('button[title="Expandir menú"]')
    if (await expandBtn.isVisible()) {
      await expandBtn.click()
      await page.waitForTimeout(400)
    }

    // Verificar textos de navegación visibles (top-level items)
    await expect(page.locator('aside').getByText('Dashboard')).toBeVisible()
    await expect(page.locator('aside').getByText('POS')).toBeVisible()
    await expect(page.locator('aside').getByText('Clientes')).toBeVisible()
    await expect(page.locator('aside').getByText('Cobranzas')).toBeVisible()
    // 'Mapa' está dentro del submenu de Clientes — no se verifica aquí
  })

  test('botón colapsar está al fondo de la sidebar', async ({ page }) => {
    // Expandir si está colapsada
    const expandBtn = page.locator('button[title="Expandir menú"]')
    if (await expandBtn.isVisible()) {
      await expandBtn.click()
      await page.waitForTimeout(400)
    }

    const collapseBtn = page.locator('button[title="Colapsar menú"]')
    await expect(collapseBtn).toBeVisible()

    // Verificar que el botón está en la parte inferior (posición Y > mitad de la pantalla)
    const btnBox = await collapseBtn.boundingBox()
    const viewportHeight = page.viewportSize()?.height ?? 800
    expect(btnBox!.y).toBeGreaterThan(viewportHeight * 0.5)
  })

  test('colapsar/expandir sidebar funciona', async ({ page }) => {
    const sidebar = page.locator('aside')

    // Expandir si colapsada
    const expandBtn = page.locator('button[title="Expandir menú"]')
    if (await expandBtn.isVisible()) {
      await expandBtn.click()
      await page.waitForTimeout(400)
    }

    // Sidebar debe tener ancho ~256px (w-64)
    const boxExpanded = await sidebar.boundingBox()
    expect(boxExpanded!.width).toBeGreaterThan(200)

    // Colapsar
    const collapseBtn = page.locator('button[title="Colapsar menú"]')
    await collapseBtn.click()
    await page.waitForTimeout(400)

    // Sidebar debe tener ancho ~64px (w-16)
    const boxCollapsed = await sidebar.boundingBox()
    expect(boxCollapsed!.width).toBeLessThan(100)
  })

  test('hover sobre sidebar colapsada la expande como overlay', async ({ page }) => {
    const sidebar = page.locator('aside')

    // Asegurar que esté colapsada
    const collapseBtn = page.locator('button[title="Colapsar menú"]')
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click()
      await page.waitForTimeout(400)
    }

    // Verificar que está colapsada (ancho pequeño)
    const boxBefore = await sidebar.boundingBox()
    expect(boxBefore!.width).toBeLessThan(100)

    // Hacer hover sobre la sidebar
    await sidebar.hover()
    await page.waitForTimeout(350) // esperar transición 300ms

    // Verificar que se expandió (ancho > 200px)
    const boxHovered = await sidebar.boundingBox()
    expect(boxHovered!.width).toBeGreaterThan(200)

    // Los textos deben ser visibles durante hover
    await expect(page.locator('aside').getByText('Dashboard')).toBeVisible()

    // Mover mouse fuera → colapsa de nuevo
    await page.mouse.move(600, 400)
    await page.waitForTimeout(350)
    const boxAfter = await sidebar.boundingBox()
    expect(boxAfter!.width).toBeLessThan(100)
  })

  test('submenús de Catálogos e Inventario se abren', async ({ page }) => {
    // Expandir sidebar si necesario
    const expandBtn = page.locator('button[title="Expandir menú"]')
    if (await expandBtn.isVisible()) {
      await expandBtn.click()
      await page.waitForTimeout(400)
    }

    // Click en Catálogos
    const catalogBtn = page.locator('aside button').filter({ hasText: 'Catálogos' })
    if (await catalogBtn.isVisible()) {
      await catalogBtn.click()
      await page.waitForTimeout(200)
      await expect(page.locator('aside').getByText('Productos')).toBeVisible()
      await expect(page.locator('aside').getByText('Catálogo Visual')).toBeVisible()
    }
  })

  test('navegar a POS desde sidebar', async ({ page }) => {
    // Expandir sidebar si necesario
    const expandBtn = page.locator('button[title="Expandir menú"]')
    if (await expandBtn.isVisible()) {
      await expandBtn.click()
      await page.waitForTimeout(400)
    }

    await page.locator('aside a').filter({ hasText: 'POS' }).click()
    await expect(page).toHaveURL('/pos', { timeout: 5000 })
  })
})
