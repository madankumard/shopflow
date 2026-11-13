import { defineConfig, devices } from '@playwright/test';

/**
 * Which environment to test and the test users' password come from the environment,
 * set by infra/e2e-test.ps1. The tests place real orders, so that script only allows
 * dev and QA.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8081';
const inPipeline = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  // The journeys build on each other (an admin creates the product a customer then orders),
  // so they run one at a time, in file order.
  fullyParallel: false,
  workers: 1,
  // A browser test can fail on timing alone; one retry in the pipeline tells that apart from a real bug.
  retries: inPipeline ? 1 : 0,
  forbidOnly: inPipeline,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // Evidence for a failure: what the browser saw, step by step.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
