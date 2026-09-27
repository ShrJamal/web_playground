import { defineConfig, devices } from "@playwright/test"

const PORT = 4173
const CI = Boolean(process.env.CI)

// End-to-end tests run against a production build served by `vp preview`.
export default defineConfig({
  testDir: "./e2e",
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `vp build && vp preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
  },
})
