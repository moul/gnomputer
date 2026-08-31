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

test("a narrow viewport keeps the chain and the height, and leads with them", async ({ page }) => {
  // The network used to be hidden here alongside identity, back when it was a
  // label. It became the switcher, so hiding it left a phone with no way to
  // see which chain it was reading, let alone change it — the one question
  // this bar exists to answer. Identity is still static, and still steps aside.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  await expect(page.locator(".island__status-item--height")).toBeVisible();
  await expect(page.locator(".island__status-item--network")).toBeVisible();
  await expect(page.locator(".island__status-item--identity")).toBeHidden();

  // Visible is not enough: the bar is wider than the screen and scrolls, so
  // an item left in place is on screen only for someone who thinks to scroll
  // a toolbar. It has to be there without scrolling.
  const network = await page.locator(".island__status-item--network").boundingBox();
  expect(network!.x).toBeGreaterThanOrEqual(0);
  expect(network!.x + network!.width).toBeLessThanOrEqual(375);

  // And it must still work as the switcher, not just read as a label.
  await page.locator("button.island__status-item--network").click();
  await expect(page.locator(".island-menu")).toBeVisible();
});

test("the desktop island keeps status on the right, after the apps", async ({ page }) => {
  // The narrow-viewport reordering is scoped to a media query; at full width
  // the bar reads wordmark → apps → status as it always has.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const wordmark = await page.locator(".island__wordmark").boundingBox();
  const status = await page.locator(".island__status").boundingBox();
  expect(status!.x).toBeGreaterThan(wordmark!.x);
});
