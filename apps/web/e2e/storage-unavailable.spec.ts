import { test, expect } from "@playwright/test";

// Firefox private browsing and locked-down enterprise profiles make
// IndexedDB throw on access. The app is designed to work without it — and
// it does — but every preference and cache write is fire-and-forget, so
// each failure became an unhandled rejection: 32 in the first nine seconds
// and still climbing at 41 by thirty. Nothing broke, but that volume
// drowns the console and would make error reporting useless.
test("the app works with storage unavailable, and does not spam the console", async ({ page }) => {
  test.setTimeout(90_000);
  const rejections: string[] = [];
  page.on("pageerror", (error) => rejections.push(error.message));

  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
  });

  await page.goto("/?pkg=gno.land/r/sys/users");

  // Still a working app: no crash screen, chrome present, chain data loads.
  await expect(page.locator(".island__clock")).toBeVisible();
  await expect(page.locator(".app-error")).toHaveCount(0);
  await expect(page.locator("#window-realm")).toContainText("r/sys/users", { timeout: 20_000 });

  // And the noise is bounded — a one-time boot cost, not one per write.
  await page.waitForTimeout(8000);
  const afterBoot = rejections.length;
  await page.waitForTimeout(15_000);
  expect(rejections.length).toBe(afterBoot);
  expect(afterBoot).toBeLessThan(15);
});
