import { test, expect } from "@playwright/test";

async function openNetworkSettings(page: import("@playwright/test").Page) {
  await page.locator('.island button[aria-label="Settings"]').click();
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
  await expect(select).toHaveValue("topaz");
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
  await expect(banner).toContainText("Topaz");

  await banner.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner).toHaveCount(0);
});
