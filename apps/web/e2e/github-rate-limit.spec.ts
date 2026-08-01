import { test, expect } from "@playwright/test";

// Unauthenticated api.github.com allows 60 requests an hour per IP, and
// exhausting it returns 403. That used to surface as a bare "403 Forbidden",
// which reads as a permissions problem and gives no hint that waiting fixes
// it (AUD-028).
test("a GitHub rate limit is explained, not shown as 403 Forbidden", async ({ page }) => {
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({
      status: 403,
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 900),
        // Real GitHub sends this; without it the browser hides the rate
        // limit headers from script and the fixture wouldn't exercise the
        // code path at all.
        "access-control-expose-headers": "X-RateLimit-Remaining, X-RateLimit-Reset",
      },
      body: "",
    })
  );

  await page.goto("/");
  await page.waitForSelector(".island__clock");
  await page.locator('.island button[aria-label="Resources"]').click();

  await expect(page.locator("#window-resources")).toContainText(/rate limit/i, {
    timeout: 15000,
  });
  await expect(page.locator("#window-resources")).toContainText(/resets in about 15 minutes/);
});
