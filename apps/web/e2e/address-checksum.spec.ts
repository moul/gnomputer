import { test, expect } from "@playwright/test";

// A real Topaz address, and the same address with its last character
// flipped. The second one still satisfies the old shape-only regex
// (/^g1[a-z0-9]{25,50}$/); only a bech32 checksum tells them apart (AUD-031).
const REAL = "g1manfred47kzduec920z88wfr64ylksmdcedlf5";
const FLIPPED = `${REAL.slice(0, -1)}4`;

test("a checksum-invalid address is not accepted as a manual identity", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");
  await page.locator('.island button[aria-label="Settings"]').click();
  await page.waitForSelector("#window-settings .window__body");
  await page.locator('#window-settings button:has-text("USER")').first().click();

  const input = page.locator('#window-settings input[type="text"]').first();

  await input.fill(FLIPPED);
  await expect(page.locator("#window-settings button:disabled")).toHaveCount(1);

  await input.fill(REAL);
  await expect(page.locator("#window-settings button:disabled")).toHaveCount(0);
});
