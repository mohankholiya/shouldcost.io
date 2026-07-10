import { test, expect } from "@playwright/test";

// Route family for this spec: GET /api/models/<id>/export is the single export
// entry point and the real entitlement gate. It resolves the org server-side
// and redirects unauthenticated callers to /login (the app convention), so the
// export feature is never reachable without a session.

test("export route requires authentication", async ({ page }) => {
  await page.goto(
    "/api/models/00000000-0000-0000-0000-000000000000/export?format=xlsx",
  );
  await expect(page).toHaveURL(/\/login$/);
});

/**
 * Full Pro export flow. Requires a seeded, authenticated Pro (or demo) session
 * (storageState) whose org can read the model below. Skipped in environments
 * without that seed; matches the model-cap.spec.ts / editor.spec.ts convention.
 * Enable once a test session exists, then replace the model id with a seeded one.
 *
 * Flow: open the model editor -> click "Export XLSX" -> a browser download fires
 * with a `.xlsx` filename. The server route streams the workbook as an
 * attachment; a Free session would instead see the UpgradePrompt (no link).
 */
test.skip("pro user downloads an XLSX from the model editor", async ({ page }) => {
  const MODEL_URL = "/models/REPLACE_WITH_SEEDED_PRO_MODEL_ID";
  await page.goto(MODEL_URL);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: /export xlsx/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
});
