import { test, expect } from "@playwright/test";

test("guest can boot the shared computer with no wallet prompt", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("toolbar", { name: "Apps" })).toBeVisible();
  await expect(page.getByText(/connect wallet/i)).toHaveCount(0);

  await page.getByLabel("Settings").click();
  await page.getByRole("button", { name: /User →/ }).click();
  // Moves the mouse to a fixed point away from the island so its hover
  // popover actually closes (its close-grace-period mouseleave logic never
  // fires if the mouse just stays where the last click happened) — the
  // Settings window can open at a position the popover still visually and
  // structurally overlaps, so hovering the window itself isn't reliably
  // "away from the island" the way a fixed off-island coordinate is.
  await page.mouse.move(700, 500);
  await page.getByRole("tab", { name: "User" }).click();
  await expect(page.locator("#window-settings").getByText(/browsing without a wallet/i)).toBeVisible();
});
