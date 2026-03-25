import { test, expect } from '@playwright/test'

/**
 * Verifica que todas las rutas API requieran autenticación.
 * Sin sesión activa, deben retornar 401.
 */

const PROTECTED_GET_ROUTES = [
  '/api/clients/all',
  '/api/clients/with-debt',
  '/api/clients/with-overdue',
  '/api/clients/up-to-date',
  '/api/clients/with-upcoming',
  '/api/clients/search?q=test',
  '/api/visits',
  '/api/installments/overdue',
  '/api/installments/upcoming',
  '/api/collections/payment-preview?client_id=00000000-0000-0000-0000-000000000000&amount=100',
  // FIX: PDF download must require auth (exposes sale + client data)
  '/api/sales/V-0001/pdf',
]

const PROTECTED_POST_ROUTES = [
  '/api/clients/blacklist',
  '/api/sales/send-receipt',
  '/api/settings/upload-logo',
  '/api/sales/generate-pdf',
]

test.describe('Seguridad de API - Rutas protegidas', () => {
  for (const route of PROTECTED_GET_ROUTES) {
    test(`GET ${route} → 401 sin sesión`, async ({ request }) => {
      const response = await request.get(`http://127.0.0.1:3000${route}`)
      expect(response.status()).toBe(401)
      const body = await response.json()
      expect(body).toHaveProperty('error')
    })
  }

  for (const route of PROTECTED_POST_ROUTES) {
    test(`POST ${route} → 401 sin sesión`, async ({ request }) => {
      const response = await request.post(`http://127.0.0.1:3000${route}`)
      expect(response.status()).toBe(401)
    })
  }
})
