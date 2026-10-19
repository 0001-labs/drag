import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://127.0.0.1:5187/examples/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm playground:dev',
      url: 'http://127.0.0.1:5188/playground/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm docs:build && pnpm docs:preview',
      url: 'http://127.0.0.1:5198/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'examples-chromium',
      testMatch: /demo\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:5187',
      },
    },
    {
      name: 'playground-chromium',
      testMatch: /playground\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:5188',
      },
    },
    {
      name: 'docs-chromium',
      testMatch: /docs\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:5198',
      },
    },
  ],
});
