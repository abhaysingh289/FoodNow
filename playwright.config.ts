import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  timeout: 90_000, // first hits compile pages on demand in dev
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run db:reset && npx next dev -p 3100",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: "file:./e2e.db",
      PAYMENT_PROVIDER: "fake",
      FAKE_WEBHOOK_SECRET: "e2e-secret",
      APP_BASE_URL: BASE_URL,
    },
  },
});
