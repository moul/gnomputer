import { test, expect } from "@playwright/test";
import { openApp } from "./open-app";

async function openNetworkSettings(page: import("@playwright/test").Page) {
  await openApp(page, "Settings");
  await page.locator('#window-settings button:has-text("NETWORK")').first().click();
  return page.locator("#window-settings select").first();
}

// Custom network *definitions* persisted, but the selection didn't: every
// reload silently dropped you back on the default, showing a different
// chain's data under an identical UI (AUD-013).
test("the chosen network survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const select = await openNetworkSettings(page);
  // Deliberately not asserting the starting value. Under the e2e RPC override
  // the active network is "mock", which `sdk.networks.list()` does not offer
  // as an option — so the control falls back to rendering whichever entry is
  // first in DEFAULT_NETWORKS. Pinning that would be pinning the array order,
  // not the default. What this test is about is that a choice survives.
  await expect(select).not.toHaveValue("betanet");
  await select.selectOption("betanet");
  await expect(select).toHaveValue("betanet");

  await page.reload();
  await page.waitForSelector(".island__clock");
  await expect(await openNetworkSettings(page)).toHaveValue("betanet");

  // Restoring a network that exists must not trip the recovery notice.
  await expect(page.locator(".network-recovery-banner")).toHaveCount(0);
});

test("a network that no longer exists is reported, not silently swapped", async ({ page }) => {
  // Seeded before first load so IndexedDB is still empty and the mirror is
  // the only stored value — the same situation as a custom network whose
  // stored definition was lost.
  await page.addInitScript(() => {
    localStorage.setItem(
      "gnomputer:mirror:active-network",
      JSON.stringify({ value: JSON.stringify("ghost-net"), at: Date.now() })
    );
  });
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const banner = page.locator(".network-recovery-banner");
  await expect(banner).toContainText("ghost-net", { timeout: 10000 });
  // Names whichever network it fell back to, which is the default.
  await expect(banner).toContainText("Sapphire");

  await banner.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner).toHaveCount(0);
});
