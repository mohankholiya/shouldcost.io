import { test, expect } from "@playwright/test";

test("compare route requires authentication", async ({ page }) => {
  await page.goto("/models/00000000-0000-0000-0000-000000000000/compare");
  await expect(page).toHaveURL(/\/login$/);
});

/**
 * Add-quote happy path. Requires a seeded, logged-in session (magic-link email)
 * and a seeded model, so it is skipped in environments without one — matching
 * tests/e2e/editor.spec.ts. Enable once a test session (storageState) is available;
 * replace MODEL_ID with the same seeded model that editor.spec.ts drives.
 */
test.skip("add a supplier quote and see the comparison", async ({ page }) => {
  const MODEL_ID = "REPLACE_WITH_SEEDED_MODEL_ID";
  await page.goto(`/models/${MODEL_ID}/compare`);

  // Empty state teaches the next steps before the first quote.
  await expect(page.getByText(/no quotes yet/i)).toBeVisible();

  await page.getByRole("button", { name: /add quote/i }).first().click();
  await page.getByLabel(/supplier/i).fill("Acme Drilling");
  await page.getByLabel(/total/i).fill("1800.00");
  await page.getByRole("button", { name: /save quote/i }).click();

  // Comparison surfaces the supplier and the total row with a gap.
  await expect(page.getByText("Acme Drilling")).toBeVisible();
  await expect(page.getByText(/total/i)).toBeVisible();
});
