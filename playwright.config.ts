import { defineConfig, devices } from '@playwright/test';

/** Its own port, so the e2e tests never reuse a `npm start` left open with other local data. */
const PORT = 4300;

/**
 * End-to-end tests against the simulated data (`ng serve` with environment.development.ts), and the
 * screenshots of `npm run screenshots` (5.6), which reuse the same server and helpers.
 */
export default defineConfig({
  testDir: 'e2e',
  // The development build is not minified and axe runs twice per check (light and dark)
  timeout: 60_000,
  // Same reason: a lazy area served by the dev server to several parallel workers can take over
  // the default 5 seconds the first time
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-ES',
    // Without animations: a click on a Material panel that is still opening (a mat-select scrolling
    // to its selected option) could land on another option. Material honours this preference.
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'e2e',
      testIgnore: 'screenshots/**',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'screenshots',
      testMatch: 'screenshots/capture.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
