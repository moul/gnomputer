import { test, expect } from "@playwright/test";
import { openApp } from "./open-app";

/** AUD-042's other half: say what is stored, and offer the one safe way to
 * reclaim some of it. The separation matters more than the numbers — the
 * crash screen already learned this the hard way, having once promised to
 * clear settings while deleting everything. */
test("the Storage tab separates what is yours from what is regenerable", async ({ page }) => {
  await page.goto("/?pkg=gno.land/r/sys/users");
  await openApp(page, "Settings");
  await page.getByRole("tab", { name: /Storage/i }).click();

  const panel = page.locator("#window-settings");
  await expect(panel).toContainText("Yours — never cleared automatically");
  await expect(panel).toContainText("Regenerable");
  await expect(panel).toContainText("Editor scripts");
  await expect(panel).toContainText("Cached chain responses");
  // The promise the button has to keep.
  await expect(panel).toContainText(/keeps your layout, theme and preferences/i);
});

test("clearing the cache empties it and leaves preferences alone", async ({ page }) => {
  await page.goto("/?pkg=gno.land/r/sys/users");
  // Change a preference so there is something that must survive.
  await openApp(page, "Settings");
  await page.getByRole("tab", { name: /Theme/i }).click();
  await page.getByRole("button", { name: /Cypherpunk/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ascii-cypherpunk");

  // Give the realm query time to land in the cache.
  await page.waitForTimeout(3000);

  await page.getByRole("tab", { name: /Storage/i }).click();
  const clear = page.getByRole("button", { name: /Clear cached chain data/i });
  await expect(clear).toBeEnabled({ timeout: 15_000 });
  await clear.click();

  await expect(page.locator("#window-settings")).toContainText(/Cached chain responses cleared/i);
  // The preference is untouched: this is not clearDisposableData(), which
  // would also have emptied the store holding the theme.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ascii-cypherpunk");
});

test("exporting offers a file rather than only a warning", async ({ page }) => {
  await page.goto("/");
  await openApp(page, "Settings");
  await page.getByRole("tab", { name: /Storage/i }).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export my data/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^gnomputer-backup-\d{4}-\d{2}-\d{2}\.json$/);
});
