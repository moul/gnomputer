import { test, expect } from "@playwright/test";

test("realm and its source render side by side on first load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("article")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("region", { name: /^Source for/ })).toBeVisible({ timeout: 15_000 });
});
