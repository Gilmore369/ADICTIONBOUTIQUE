import { test, expect } from '@playwright/test'

/**
 * Verifica que todas las páginas protegidas redirijan a /login sin sesión.
 */

const PROTECTED_PAGES = [
  '/dashboard',
  '/clients',
  '/pos',
  '/catalogs',
  '/catalogs/visual',
  '/inventory/stock',
  '/inventory/bulk-entry-test', // admin-only test page
  '/collections',
  '/map',
  '/reports',
  '/settings',
]

test.describe('Páginas protegidas → redirigen a /login', () => {
  for (const page of PROTECTED_PAGES) {
    test(`${page} redirige a /login sin sesión`, async ({ page: browserPage }) => {
      await browserPage.goto(page)
      await expect(browserPage).toHaveURL(/\/login/, { timeout: 5000 })
    })
  }
})
