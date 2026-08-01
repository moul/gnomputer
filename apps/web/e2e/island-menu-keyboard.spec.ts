import { test, expect } from "@playwright/test";

const focusedText = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");

// The island menus were Tab-only: reachable, but you walked through every
// item of every menu in document order rather than moving within the one you
// opened (AUD-014).
test("an island menu is navigable with arrow keys and closes on Escape", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const trigger = page.locator('.island button[aria-label="Settings"]');
  await trigger.focus();
  await expect(page.locator(".island__popover")).toHaveCount(1);

  const items = page.locator(".island__popover button, .island__popover a[href]");
  const labels = (await items.allTextContents()).map((t) => t.trim());

  // Down enters the menu rather than doing nothing.
  await page.keyboard.press("ArrowDown");
  expect(await focusedText(page)).toBe(labels[0]);

  await page.keyboard.press("ArrowDown");
  expect(await focusedText(page)).toBe(labels[1]);

  await page.keyboard.press("End");
  expect(await focusedText(page)).toBe(labels[labels.length - 1]);

  await page.keyboard.press("Home");
  expect(await focusedText(page)).toBe(labels[0]);

  // Wraps, as the APG menu pattern specifies for a short closed list.
  await page.keyboard.press("ArrowUp");
  expect(await focusedText(page)).toBe(labels[labels.length - 1]);

  // Escape must close it AND leave it closed: the trigger's onFocus opens
  // the menu, so restoring focus used to reopen what Escape had just shut.
  await page.keyboard.press("Escape");
  await expect(page.locator(".island__popover")).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe(
    "Settings"
  );
});
