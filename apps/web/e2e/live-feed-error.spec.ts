import { test, expect } from "@playwright/test";

// A live feed used to sit on "Watching the chain…" forever when the
// endpoint was unreachable — indistinguishable from a quiet chain.
test("a live feed reports an unreachable chain instead of watching forever", async ({ page }) => {
  await page.route("**/127.0.0.1:26658/**", (r) => r.abort());
  await page.goto("/");
  await page.waitForSelector(".island");

  await page.getByRole("button", { name: "Chain", exact: true }).hover();
  await page.getByRole("button", { name: "Event Explorer" }).click();

  const win = page.locator(".window", { has: page.locator(".event-explorer") });
  await expect(win).toBeVisible();
  await expect(win.getByText(/reach the chain right now/i)).toBeVisible({ timeout: 20_000 });
  await expect(win.getByText("Watching the chain for events…")).toHaveCount(0);
});
