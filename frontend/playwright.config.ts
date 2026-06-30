import { defineConfig, devices } from '@playwright/test'

// E2E runs against the dev stack (frontend :5173 → /api proxy → backend :3000 →
// local Postgres). The servers are started if not already running, and reused
// if they are. A global setup seeds the verified demo user first.
const BASE_URL = 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // Integration flow that shares one DB — keep it serial and deterministic.
  fullyParallel: false,
  workers: 1,
  // One retry absorbs rare dev-stack transients (the test shares a DB and a
  // hot-reloading dev server). The only deterministic race — reloading before
  // the state PATCH lands — is fixed in the spec via waitForResponse, not here.
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run start:dev',
      cwd: '../backend',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
