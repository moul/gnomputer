import { test, expect } from "@playwright/test";

// A memoized rejected connection promise meant one unreachable moment
// poisoned the RPC client for the lifetime of the page: every later call
// awaited the same settled rejection and failed instantly without touching
// the network. Measured before the fix: exactly ONE request ever left the
// browser, no polling, no retry, and a Try again button that issued nothing.
test("the app keeps trying, and recovers, after the chain goes away", async ({ page }) => {
  test.setTimeout(90_000);
  let blocked = true;
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") posts++;
  });
  await page.route("**/127.0.0.1:26658/**", (route) => (blocked ? route.abort() : route.continue()));

  await page.goto("/?pkg=gno.land/r/sys/users");
  await page.waitForSelector("#window-realm");
  await page.waitForTimeout(4000);

  // It must keep trying while the chain is down, not give up after one.
  const duringOutage = posts;
  await page.waitForTimeout(12_000);
  expect(posts - duringOutage).toBeGreaterThan(1);

  // And it must resume on its own once the chain is back — no reload.
  blocked = false;
  const beforeRecovery = posts;
  await page.waitForTimeout(12_000);
  expect(posts - beforeRecovery).toBeGreaterThan(1);

  // A one-shot query still needs its Try again, but that button has to
  // actually issue a request — before the fix it issued none at all.
  const retry = page.locator(".state-line__retry").first();
  if (await retry.count()) {
    const beforeClick = posts;
    await retry.click();
    await expect.poll(() => posts, { timeout: 10_000 }).toBeGreaterThan(beforeClick);
  }
});
