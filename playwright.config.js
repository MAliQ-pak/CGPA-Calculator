import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run the real app against tests/mock-firebase.js (see tests/e2e/fixtures.js),
// so they need no Firebase project or network access.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: 'node tests/serve.js',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
