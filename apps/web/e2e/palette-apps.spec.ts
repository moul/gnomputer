import { test, expect } from "@playwright/test";

// The README says "unopened apps live behind the island bar's icons and a
// command palette (⌘K)". The island half was true; the palette only ever
// resolved entities, so you could not reach a single app from it — a false
// capability claim as much as a missing feature (AUD-046).
async function openPalette(page: import("@playwright/test").Page) {
  await page.locator('.island button[aria-label*="command palette"]').click();
  return page.locator(".command-palette input");
}

test("an app can be found and opened from the palette", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const input = await openPalette(page);
  await input.fill("editor");
  await expect(page.locator(".command-palette__apps button")).toHaveText([/Editor/]);

  await input.press("Enter");
  await expect(page.locator("#window-editor")).toBeVisible();
  await expect(page.locator(".command-palette")).toHaveCount(0);
});

test("apps with no island icon are reachable here", async ({ page }) => {
  // These are otherwise reachable only contextually — a trail step, an
  // entity link — so the palette is the one place to find them on purpose.
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const input = await openPalette(page);
  await input.fill("governance");
  await page.locator(".command-palette__apps button").first().click();
  await expect(page.locator("#window-governance")).toBeVisible();
});

test("an address still resolves as an entity, not an app", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const input = await openPalette(page);
  await input.fill("g1manfred47kzduec920z88wfr64ylksmdcedlf5");
  await expect(page.locator(".command-palette__apps button")).toHaveCount(0);
});
