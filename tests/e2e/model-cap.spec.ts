import { test, expect } from "@playwright/test";

// Route family for this spec: /projects/<id> renders <TemplatePicker>, which is
// where the model-cap is enforced server-side by instantiateModelAction.

test("project route requires authentication", async ({ page }) => {
  await page.goto("/projects/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login$/);
});

/**
 * Full Free-tier model-cap flow. Requires a seeded, authenticated, NON-DEMO
 * Free-org session (storageState) — the demo org (`is_demo = true`) bypasses
 * caps and cannot exercise this path. Skipped in environments without that seed;
 * matches the editor.spec.ts / compare.spec.ts convention. Enable once a test
 * session is available, then replace the project id below with the seeded one.
 *
 * Flow: create 2 models (both succeed) -> 3rd attempt is blocked server-side by
 * instantiateModelAction's canCreateModel gate -> TemplatePicker surfaces the
 * "2-model Free limit" copy + the Upgrade link. Never a silent failure.
 */
test.skip("free user is capped at 2 models and sees an upgrade prompt", async ({ page }) => {
  const PROJECT_URL = "/projects/REPLACE_WITH_SEEDED_NONDEMO_PROJECT_ID";
  await page.goto(PROJECT_URL);

  // Create two models — both succeed.
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /new model/i }).click();
    await page.getByRole("button", { name: /blank model/i }).click();
    await page.waitForURL(/\/models\/.+$/);
    await page.goto(PROJECT_URL);
  }

  // The third attempt is blocked and surfaces the upgrade prompt.
  await page.getByRole("button", { name: /new model/i }).click();
  await page.getByRole("button", { name: /blank model/i }).click();
  await expect(page.getByText(/2-model/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /upgrade/i })).toBeVisible();
});
