import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import dotenv from 'dotenv'

// Load .env.local for TEST_EMAIL / TEST_PASSWORD
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

const AUTH_FILE = 'tests/e2e/.auth/user.json'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // ── Setup: login once and save auth state ──────────────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // ── Security tests (no auth needed) ────────────────────────────────────
    {
      name: 'security',
      testMatch: /(api-security|auth|pages-redirect)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // ── UI tests (reuse saved login) ────────────────────────────────────────
    {
      name: 'ui-authenticated',
      testMatch: /ui-.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
    },
  ],
})
