import { test, expect } from "@playwright/test";
import { openApp } from "./open-app";

// A real Topaz address, and the same address with its last character
// flipped. The second one still satisfies the old shape-only regex
// (/^g1[a-z0-9]{25,50}$/); only a bech32 checksum tells them apart (AUD-031).
const REAL = "g1manfred47kzduec920z88wfr64ylksmdcedlf5";
const FLIPPED = `${REAL.slice(0, -1)}4`;

test("a checksum-invalid address is not accepted as a manual identity", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");
  await openApp(page, "Settings");
  await page.waitForSelector("#window-settings .window__body");
  await page.locator('#window-settings button:has-text("USER")').first().click();

  const input = page.locator('#window-settings input[type="text"]').first();
  // Target this one button rather than counting disabled buttons in the
  // window: the Network tab has its own disabled submit, so a count races
  // with the tab switch.
  const useAddress = page.getByRole("button", { name: "Use this address" });

  await input.fill(FLIPPED);
  await expect(useAddress).toBeDisabled();

  await input.fill(REAL);
  await expect(useAddress).toBeEnabled();
});
