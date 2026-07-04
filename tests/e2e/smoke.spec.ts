import { test, expect } from "@playwright/test";

test("unauthenticated visit to a protected route redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("login page renders the magic-link form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("you@company.com")).toBeVisible();
  await expect(page.getByRole("button", { name: /magic link/i })).toBeVisible();
});

test("marketing home renders the disclaimer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/not certified cost audits/i)).toBeVisible();
});
