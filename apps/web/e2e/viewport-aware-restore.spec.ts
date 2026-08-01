import { test, expect } from "@playwright/test";

// A layout is saved with the geometry of the screen it was made on.
// Restoring a desktop layout on a phone left windows positioned past the
// right edge, at sizes wider than the viewport — unreachable (AUD-008).
//
// The layout is created by actually moving and resizing the window rather
// than by seeding storage: window layout persistence does not go through
// the localStorage mirror, so a seeded mirror is silently ignored and the
// test would pass without ever restoring anything.
async function saveAWideLayout(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  await page.waitForSelector("#window-realm");

  // Drag the titlebar far to the right.
  const titlebar = page.locator("#window-realm .window__titlebar");
  await titlebar.hover();
  await page.mouse.down();
  await page.mouse.move(1400, 500, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(async () => (await page.locator("#window-realm").boundingBox())!.x)
    .toBeGreaterThan(400);
  // The write is queued behind the state change.
  await page.waitForTimeout(1000);
}

test("a wide layout restored on a phone is fully on screen", async ({ page }) => {
  await saveAWideLayout(page);
  const wide = (await page.locator("#window-realm").boundingBox())!;

  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/");
  await page.waitForSelector("#window-realm");
  await page.waitForTimeout(1500);

  const box = (await page.locator("#window-realm").boundingBox())!;
  expect(wide.x).toBeGreaterThan(390); // the saved layout really was off a phone screen
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  expect(box.y + box.height).toBeLessThanOrEqual(781);
});

test("the same layout restored on a big screen keeps its position", async ({ page }) => {
  // The clamp must only shrink what no longer fits.
  await saveAWideLayout(page);
  const before = (await page.locator("#window-realm").boundingBox())!;

  await page.goto("/");
  await page.waitForSelector("#window-realm");
  await page.waitForTimeout(1500);

  const after = (await page.locator("#window-realm").boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(4);
  expect(Math.abs(after.width - before.width)).toBeLessThan(4);
});

test("restoring onto a narrower desktop shrinks windows that no longer fit", async ({ page }) => {
  // Above the phone breakpoint (480px), so windows are NOT maximized — this
  // exercises the clamp itself rather than the phone fallback. The two are
  // separate halves of the fix and each needs its own case.
  await saveAWideLayout(page);

  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto("/");
  await page.waitForSelector("#window-realm");
  await page.waitForTimeout(1500);

  await expect(page.locator("#window-realm")).not.toHaveClass(/window--maximized/);
  const box = (await page.locator("#window-realm").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(801);
  expect(box.y + box.height).toBeLessThanOrEqual(701);
});
