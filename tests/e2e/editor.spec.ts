import { test, expect } from "@playwright/test";

test("editor route requires authentication", async ({ page }) => {
  await page.goto("/models/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login$/);
});

/**
 * Full editing flow. Requires a seeded, logged-in session (magic-link email),
 * so it is skipped in environments without one. Enable once a test session
 * (storageState) is available.
 */
test.skip("template -> edit rate -> total updates -> save version", async ({ page }) => {
  // 1. Sign in (via stored session state).
  // 2. Open a project, click "New model", choose "OCTG casing & tubing".
  await page.getByRole("button", { name: "New model" }).click();
  await page.getByText("OCTG casing & tubing").click();
  // 3. Expect the should-cost total near $1,760.
  await expect(page.getByText(/1,7\d\d/)).toBeVisible();
  // 4. Edit the billet rate and expect the total to change.
  // 5. Click "Save version" and expect a v1 row to appear.
  await page.getByRole("button", { name: "Save version" }).click();
  await expect(page.getByText("v1")).toBeVisible();
});
