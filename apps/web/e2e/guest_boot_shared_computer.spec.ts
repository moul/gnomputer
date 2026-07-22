import { test, expect } from "@playwright/test";

test("guest can boot the shared computer with no wallet prompt", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("You are browsing the shared computer.")).toBeVisible();
  await expect(page.getByText(/browsing as guest/i)).toBeVisible();
  await expect(page.getByText(/connect wallet/i)).toHaveCount(0);
});
