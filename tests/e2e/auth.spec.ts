import { test, expect } from '@playwright/test'

test.describe('Autenticación', () => {
  test('redirige a /login cuando no hay sesión', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('página de login carga correctamente', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('credenciales incorrectas muestran error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'noexiste@test.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    // Esperar respuesta de error (no redirige a dashboard)
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/login/)
  })
})
