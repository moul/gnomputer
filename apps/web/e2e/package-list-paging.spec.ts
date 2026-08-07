import { test, expect } from "@playwright/test";

// The list rendered 500 interactive rows up front and rebuilt them on every
// keystroke (AUD-039).
test("the package list renders a page at a time and pages on demand", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.waitForSelector(".island");
  await page.getByRole("button", { name: "Discover", exact: true }).hover();
  await page.getByRole("button", { name: /Realms/ }).first().click();

  const win = page.locator(".window", { has: page.locator(".discover-packages") });
  await expect(win).toBeVisible();
  await page.waitForTimeout(1500);

  const rows = win.locator("tbody tr");
  const initial = await rows.count();
  console.log("initial rows:", initial);
  // A page, not the whole result set.
  expect(initial).toBeLessThanOrEqual(100);

  const showMore = win.getByRole("button", { name: "Show more" });
  if (await showMore.count()) {
    await showMore.click();
    await page.waitForTimeout(400);
    const after = await rows.count();
    console.log("after Show more:", after);
    expect(after).toBeGreaterThan(initial);
  }
});
