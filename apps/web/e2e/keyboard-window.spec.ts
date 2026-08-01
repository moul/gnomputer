import { test, expect } from "@playwright/test";

// Move, resize and maximize were all pointer-only gestures — drag,
// drag-the-corner, and titlebar double-click (AUD-016).
test("a window can be maximized, moved and resized from the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.waitForSelector(".island");

  const titlebar = page.locator(".window__titlebar").first();
  await expect(titlebar).toBeVisible();

  const before = await titlebar.boundingBox();
  await titlebar.focus();
  await expect(titlebar).toBeFocused();

  // Arrow keys move it.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(300);
  const moved = await titlebar.boundingBox();
  console.log("x:", before!.x, "->", moved!.x, " y:", before!.y, "->", moved!.y);
  expect(moved!.x).toBeGreaterThan(before!.x);
  expect(moved!.y).toBeGreaterThan(before!.y);

  // Shift+arrow resizes.
  const w0 = (await page.locator(".window").first().boundingBox())!.width;
  await page.keyboard.press("Shift+ArrowRight");
  await page.waitForTimeout(300);
  const w1 = (await page.locator(".window").first().boundingBox())!.width;
  console.log("width:", w0, "->", w1);
  expect(w1).toBeGreaterThan(w0);

  // And a real maximize control exists.
  const maximize = page.getByRole("button", { name: /^Maximize / }).first();
  await expect(maximize).toBeVisible();
  await maximize.click();
  await page.waitForTimeout(300);
  await expect(page.getByRole("button", { name: /^Restore / }).first()).toBeVisible();
});
