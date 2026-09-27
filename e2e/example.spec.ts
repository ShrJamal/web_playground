import { expect, test } from "@playwright/test"

// E2E tests drive the built app by URL. Replace this example with real user flows.
test("loads the home page", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
})
