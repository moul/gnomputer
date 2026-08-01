import { test, expect } from "@playwright/test";

// The island was icons and a clock. Which chain you were on, whether it was
// keeping up, and who you were acting as all lived inside popovers — so the
// context needed to read anything on screen was invisible until you went
// looking (AUD-011).
test("the island shows network, height and identity without opening anything", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const status = page.locator(".island__status");
  await expect(status.locator(".island__status-item--network")).toContainText("Mock");
  await expect(status.locator(".island__status-item--height")).toContainText(/#[\d,]+/, {
    timeout: 15000,
  });
  // toContainText, not toHaveText: the visually-hidden "Signed in as:"
  // prefix is real text in the accessibility tree and part of textContent.
  await expect(status.locator(".island__status-item--identity")).toContainText("Guest");

  // The app says its own name. In a browser tab the title carries it;
  // installed as a PWA there is no tab.
  await expect(page.locator(".island__wordmark")).toBeVisible();
});

test("the live value survives a narrow viewport; the static ones step aside", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  await expect(page.locator(".island__status-item--height")).toBeVisible();
  await expect(page.locator(".island__status-item--network")).toBeHidden();
  await expect(page.locator(".island__status-item--identity")).toBeHidden();

  // The island must still fit, or it pushes the clock off screen.
  const island = await page.locator(".island").boundingBox();
  expect(island!.width).toBeLessThan(700);
});
