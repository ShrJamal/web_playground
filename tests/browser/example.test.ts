import { expect, test } from "vite-plus/test"
import { page } from "vite-plus/test/browser"

// Browser tests run in headless Chromium. Replace this example with DOM or UI tests.
test("renders into the page", async () => {
  document.body.innerHTML = `<button type="button">Save</button>`

  await expect.element(page.getByRole("button", { name: "Save" })).toBeVisible()
})
