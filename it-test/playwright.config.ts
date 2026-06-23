import * as path from 'path';
import { defineConfig } from '@playwright/test';

/**
 * Integration tests (it-test) for the local MockServer-based mock API.
 *
 * Playwright's `webServer` block boots the real mock server with `npm start`
 * (run from the repo root) and waits until `/health` answers before any test
 * runs, so the suite is fully self-contained: `npm run test:it` starts the
 * server, exercises every contract endpoint over HTTP, then tears it down.
 */

// Host/port the mock binds to. Mirrors src/configuration/config.ts so the tests
// follow the same env overrides ($PORT wins on hosts like Render, then
// MOCK_SERVER_PORT, then the 1080 default).
const HOST = process.env.MOCK_SERVER_HOST || 'localhost';
const PORT = process.env.PORT || process.env.MOCK_SERVER_PORT || '1080';
export const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: './tests',
  // Contract endpoints are independent, so run files in parallel.
  fullyParallel: true,
  // Fail the CI build if a `test.only` is left behind.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },

  // Boot the mock server before the suite and shut it down afterwards.
  webServer: {
    command: 'npm start',
    // Run `npm start` from the repo root (one level up from this config).
    cwd: path.resolve(__dirname, '..'),
    url: `${BASE_URL}/health`,
    // The MockServer netty jar can be slow to start on a cold/slow host.
    timeout: 120_000,
    // Locally, attach to an already-running server; in CI always start fresh.
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    // Keep the boot logs quiet — MockServer's per-request DEBUG output is very
    // chatty and drowns the test results. Override at the shell to debug.
    env: {
      MOCK_SERVER_VERBOSE: process.env.MOCK_SERVER_VERBOSE || 'false',
      MOCK_SERVER_TRACE: process.env.MOCK_SERVER_TRACE || 'false',
    },
  },
});
