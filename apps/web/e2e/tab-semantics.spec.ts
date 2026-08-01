import { test, expect } from "@playwright/test";

// role="tablist" previously contained the New-tab and pop-out ACTIONS (an
// invalid tablist, flagged by Lighthouse) and its tabs were plain buttons
// with no role, no aria-selected, and no arrow-key navigation (AUD-015).
test("realm tabs expose real tab semantics and arrow-key navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?pkg=gno.land%2Fr%2Fgnoland%2Fblog");
  await page.waitForTimeout(2000);

  const tablist = page.locator("[role=tablist][aria-label='Open realms']").first();
  await expect(tablist).toBeVisible();

  // The tablist must contain ONLY tabs.
  const nonTabButtons = await tablist.locator("button:not([role=tab]):not(.realm-browser__tab-close)").count();
  expect(nonTabButtons).toBe(0);
  // ...and the actions must still exist, just outside it.
  await expect(page.getByRole("button", { name: "New tab" })).toBeVisible();

  const firstTab = tablist.getByRole("tab").first();
  await expect(firstTab).toHaveAttribute("aria-selected", "true");

  // Open a second tab, then drive selection with the keyboard alone.
  await page.getByRole("button", { name: "New tab" }).click();
  await page.waitForTimeout(800);
  const tabs = tablist.getByRole("tab");
  expect(await tabs.count()).toBe(2);

  const selected = tablist.locator("[role=tab][aria-selected=true]");
  await selected.focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(400);
  // Selection moved, and focus followed it.
  await expect(tablist.locator("[role=tab][aria-selected=true]")).toBeFocused();

  await page.keyboard.press("Home");
  await page.waitForTimeout(400);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
});
