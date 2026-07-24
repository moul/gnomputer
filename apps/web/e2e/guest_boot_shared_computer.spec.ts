import { test, expect } from "@playwright/test";

test("guest can boot the shared computer with no wallet prompt", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("toolbar", { name: "Apps" })).toBeVisible();
  await expect(page.getByText(/connect wallet/i)).toHaveCount(0);

  await page.getByLabel("Settings").click();
  await page.getByRole("button", { name: /User →/ }).click();
  // Moves the mouse off the island so its hover popover actually closes
  // (its close-grace-period mouseleave logic never fires if the mouse
  // just stays where the last click happened) — otherwise it can still
  // overlap and intercept the click below.
  await page.locator("#window-settings").hover();
  await page.getByRole("tab", { name: "User" }).click();
  await expect(page.locator("#window-settings").getByText(/browsing without a wallet/i)).toBeVisible();
});
