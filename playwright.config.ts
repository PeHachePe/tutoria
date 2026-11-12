import { defineConfig, devices } from '@playwright/test';

/** Its own port, so the e2e tests never reuse a `npm start` or `npm run serve:demo` left open. */
const PORT = 4300;

/** The published app, for the smoke test of `npm run smoke` (step 3.1): no local server then. */
const SMOKE_URL = process.env['SMOKE_URL'];

/**
 * End-to-end tests and the screenshots of `npm run screenshots` (5.6) against the `demo` build:
 * optimized like production and with the simulated data, served as static files (step 1.1e, D-025).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: SMOKE_URL ?? `http://localhost:${PORT}`,
    locale: 'es-ES',
    // Without animations: a click on a Material panel that is still opening (a mat-select scrolling
    // to its selected option) could land on another option. Material honours this preference.
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'e2e',
      testIgnore: ['screenshots/**', 'smoke/**'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'screenshots',
      testMatch: 'screenshots/capture.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'smoke',
      testMatch: 'smoke/**',
      // The free cloud starts cold and is farther than the local demo: more room to wait
      expect: { timeout: 30_000 },
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: SMOKE_URL
    ? undefined
    : {
        // Built on every run (a few seconds with the cache), and never an already running server, so
        // the tests never see an old build
        command: `npm run build:demo && npm run serve:demo -- ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
