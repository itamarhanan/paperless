import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets several checkouts run their tests side by side
const PORT = Number(process.env.E2E_PORT ?? 3123);

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  // The AI answers take a few seconds, and parallel tests share two workers
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 800 } } },
  ],
  webServer: {
    // The production build, like CI: the dev server resets state when its lazy
    // chunks load, which loses the guided tour and the chat panel mid-test
    command: `pnpm build && pnpm start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
