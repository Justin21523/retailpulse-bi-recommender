import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3011',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'PYTHONPATH=src uv run uvicorn api.main:app --host 127.0.0.1 --port 8010',
      cwd: '..',
      url: 'http://127.0.0.1:8010/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'NEXT_PUBLIC_API_URL=http://127.0.0.1:8010 npm run build && NEXT_PUBLIC_API_URL=http://127.0.0.1:8010 npm run start -- --hostname 127.0.0.1 --port 3011',
      url: 'http://127.0.0.1:3011',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 950 } },
    },
  ],
})
