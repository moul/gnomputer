import { test, expect } from "@playwright/test";

// "Updated just now" means different things depending on where the data came
// from: a chain query is the chain's own answer as of that moment, while a
// fresh fetch of stale indexer data reads exactly the same (AUD-047).
test("indexer-backed data says so next to its timestamp @live", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1500, height: 950 });
  // The mock chain has no indexer configured, so this needs the real one.
  await page.goto("/?net=topaz");
  await page.waitForSelector(".island");

  await page.getByRole("button", { name: "Discover", exact: true }).hover();
  await page.getByRole("button", { name: /Transactions/ }).first().click();
  await page.mouse.move(0, 0);

  const badge = page.locator(".freshness__source").first();
  await expect(badge).toBeVisible({ timeout: 30_000 });
  await expect(badge).toHaveText(/via indexer/i);
  await expect(badge).toHaveAttribute("title", /lag behind/);
});
