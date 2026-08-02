import { test, expect } from "@playwright/test";

/** The README has promised shareable links for a while, and they worked —
 * but the only way to get one was to select the browser's address bar. In
 * the installed PWA there is no address bar, so on the platform the app
 * most wants you to install it to, the feature was unreachable. */
test("the copy-link button puts the current view's URL on the clipboard", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?pkg=gno.land/r/sys/users&lens=source");
  await page.waitForSelector(".island__clock");

  const button = page.locator(".share-link-button").first();
  await expect(button).toHaveAttribute("data-state", "idle");
  await button.click();
  await expect(button).toHaveAttribute("data-state", "copied");

  // The link has to carry the view, not just the origin — that is the whole
  // claim being made about it.
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(decodeURIComponent(copied)).toContain("pkg=gno.land/r/sys/users");
  expect(copied).toContain("lens=source");
});

test("the copied state reverts, rather than claiming copied forever", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?pkg=gno.land/r/sys/users");
  await page.waitForSelector(".island__clock");

  const button = page.locator(".share-link-button").first();
  await button.click();
  await expect(button).toHaveAttribute("data-state", "copied");
  await expect(button).toHaveAttribute("data-state", "idle", { timeout: 6000 });
});

test("the same link is reachable as a palette command", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?pkg=gno.land/r/sys/users");
  await page.waitForSelector(".island__clock");
  await page.evaluate(() => navigator.clipboard.writeText("not-the-link"));

  await page.locator('.island button[aria-label*="command palette"]').click();
  await page.locator(".command-palette input").fill("copy link");
  await page.locator(".command-palette__commands button").first().click();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(decodeURIComponent(copied)).toContain("pkg=gno.land/r/sys/users");
});
