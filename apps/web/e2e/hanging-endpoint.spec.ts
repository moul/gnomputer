import { test, expect } from "@playwright/test";

// The tm2 client and JSON-RPC provider use their own transport and honour no
// timeout, so fetchWithDeadline never covered them. An endpoint that accepts
// the connection and never answers left the app on a spinner indefinitely —
// measured at 30s with no error, no retry, and one request outstanding. Not
// a crash, which is worse: a spinner that never resolves gives no reason to
// suspect the endpoint rather than the app (AUD-023).
test("a hanging endpoint eventually errors instead of spinning forever", async ({ page }) => {
  test.setTimeout(120_000);
  // Accept every chain request and never answer it.
  await page.route("**/127.0.0.1:26658/**", () => {});

  await page.goto("/?pkg=gno.land/r/sys/users");
  await page.waitForSelector("#window-realm");

  // The 15s deadline, with headroom for CI being slower than a laptop.
  await expect(page.locator(".state-line--error").first()).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

  // And the chrome stops claiming it is still connecting. Slower than the
  // panel because the status query gets its one retry first: 15s deadline
  // twice, measured at 35s.
  await expect
    .poll(
      () => page.locator(".island__clock .status-dot").getAttribute("data-state"),
      { timeout: 60_000 }
    )
    .not.toBe("connecting");
});
