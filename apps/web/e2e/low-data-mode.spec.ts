import { test, expect, type Page } from "@playwright/test";

async function openClockMenu(page: Page) {
  await page.waitForSelector(".island__clock");
  await page.locator(".island__clock").hover();
  await expect(page.locator(".island-menu--clock")).toBeVisible();
}

/** AUD-042. Every live view in this app is driven by one shared height poll,
 * so pausing has to be one switch rather than a button per view — and it has
 * to actually stop the requests, not just relabel the UI. */
test("pausing live updates stops polling the chain, and resuming restarts it", async ({ page }) => {
  let statusCalls = 0;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && (request.postData() ?? "").includes('"status"')) statusCalls++;
    await route.continue();
  });

  await page.goto("/");
  await openClockMenu(page);

  const toggle = page.locator(".island-menu__toggle input");
  await toggle.check();
  await page.mouse.move(0, 0);

  // The badge says so, and says which of the two reasons it is.
  await expect(page.locator('.island__status-badge[data-kind="low-data"]')).toHaveText("Paused");

  // And nothing is asking the chain anything any more.
  await page.waitForTimeout(1500);
  const settled = statusCalls;
  await page.waitForTimeout(9000);
  expect(statusCalls, "no status polls while paused").toBe(settled);

  await openClockMenu(page);
  await page.locator(".island-menu__toggle input").uncheck();
  await page.mouse.move(0, 0);
  await expect(page.locator('.island__status-badge[data-kind="low-data"]')).toHaveCount(0);
  await expect
    .poll(() => statusCalls, { timeout: 15_000, message: "polling resumes" })
    .toBeGreaterThan(settled);
});

test("the paused choice survives a reload", async ({ page }) => {
  // Someone who turned polling off to protect a mobile allowance did not mean
  // "until I reload".
  await page.goto("/");
  await openClockMenu(page);
  await page.locator(".island-menu__toggle input").check();
  await page.mouse.move(0, 0);
  await expect(page.locator('.island__status-badge[data-kind="low-data"]')).toBeVisible();

  await page.waitForTimeout(1200); // let the write land
  await page.reload();
  await expect(page.locator('.island__status-badge[data-kind="low-data"]')).toBeVisible();
  await openClockMenu(page);
  await expect(page.locator(".island-menu__toggle input")).toBeChecked();
});

test("the height is kept while paused, rather than blanked", async ({ page }) => {
  // Blanking it would make every view that reads the height look broken
  // rather than frozen — and the height is exactly the number that tells you
  // how stale everything else is.
  await page.goto("/");
  await expect(page.locator(".island__status-item--height")).toContainText(/#[\d,]+/);
  await openClockMenu(page);
  await page.locator(".island-menu__toggle input").check();
  await page.mouse.move(0, 0);
  await expect(page.locator(".island__status-item--height")).toContainText(/#[\d,]+/);
});

test("going offline shows Offline, not Paused", async ({ page, context }) => {
  // One of these the user chose and can undo; the other happened to them.
  // Telling someone in a tunnel that they are in low-data mode answers a
  // question they did not ask.
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  await context.setOffline(true);
  await expect(page.locator('.island__status-badge[data-kind="offline"]')).toHaveText("Offline");
  await expect(page.locator('.island__status-badge[data-kind="low-data"]')).toHaveCount(0);

  await context.setOffline(false);
  await expect(page.locator('.island__status-badge[data-kind="offline"]')).toHaveCount(0);
});
