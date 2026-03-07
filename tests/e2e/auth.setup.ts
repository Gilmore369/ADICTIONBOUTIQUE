/**
 * Playwright Auth Setup
 * Runs ONCE before all tests. Logs in and saves auth state to file.
 * All authenticated tests reuse this state (no repeated logins).
 */

import { test as setup, expect } from '@playwright/test'
import path from 'path'

export const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup('login de usuario', async ({ page }) => {
  const email    = process.env.TEST_EMAIL    || ''
  const password = process.env.TEST_PASSWORD || ''

  if (!email || !password || password === 'TU_PASSWORD_AQUI') {
    console.warn('⚠️  TEST_EMAIL / TEST_PASSWORD no configurados en .env.local — saltando login')
    return
  }

  await page.goto('/login')
  await page.fill('input[type="email"]',    email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')

  // Esperar redirección a dashboard o cualquier página protegida
  await page.waitForURL(/\/(dashboard|clients|pos|catalogs)/, { timeout: 15000 })
  expect(page.url()).not.toContain('/login')

  // Guardar estado de autenticación (cookies + localStorage)
  await page.context().storageState({ path: AUTH_FILE })
  console.log('✅ Login exitoso — estado guardado en', AUTH_FILE)
})
