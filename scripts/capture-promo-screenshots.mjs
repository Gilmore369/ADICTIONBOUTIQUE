import { chromium } from '@playwright/test'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'

dotenv.config({ path: path.resolve('.env.local') })

const BASE_URL = process.env.PROMO_BASE_URL || 'https://adictionboutique.agsys.es'
const AUTH_FILE = path.resolve('tests/e2e/.auth/user.json')
const OUT_DIR = path.resolve('public/videos/screenshots')

const pages = [
  ['dashboard.png', '/dashboard'],
  ['pos.png', '/pos'],
  ['sales.png', '/sales'],
  ['cash.png', '/cash'],
  ['returns.png', '/returns'],
  ['stock.png', '/inventory/stock'],
  ['movements.png', '/inventory/movements'],
  ['visual-catalog.png', '/catalogs/visual'],
  ['clients-dashboard.png', '/clients'],
  ['credit-plans.png', '/debt/plans'],
  ['map.png', '/map'],
  ['reports.png', '/reports?tab=sales'],
  ['admin-users.png', '/admin/users'],
]

const waitForReady = async (page) => {
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
  await page.locator('.animate-spin').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(2200)
}

const loginIfNeeded = async (page) => {
  if (!page.url().includes('/login')) return

  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!email || !password) {
    throw new Error('Missing TEST_EMAIL or TEST_PASSWORD in .env.local')
  }

  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })
  await page.context().storageState({ path: AUTH_FILE })
}

fs.mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  storageState: fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined,
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
})

await context.addInitScript(() => {
  localStorage.setItem('theme-mode', 'dark')
  localStorage.removeItem('theme-color')
  localStorage.removeItem('theme-preset')
  document.documentElement.classList.add('dark')
})

const page = await context.newPage()

for (const [filename, route] of pages) {
  const url = new URL(route, BASE_URL).toString()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await loginIfNeeded(page)

  if (!page.url().includes(route.split('?')[0])) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  }

  await waitForReady(page)
  const target = path.join(OUT_DIR, filename)
  await page.screenshot({ path: target, fullPage: false })
  console.log(`captured ${filename} <- ${page.url()}`)
}

await browser.close()
