import { test, expect } from "@playwright/test";

// Views interpolated raw upstream error.message, so a dropped connection
// read "Could not load this realm: Failed to fetch" — the browser's own
// opaque wording, which is not an explanation (AUD-035).
test("a network failure reads as something a person can act on", async ({ page }) => {
  await page.route("**/127.0.0.1:26658/**", (route) => route.abort());
  await page.goto("/?pkg=gno.land/r/sys/users");
  await page.waitForSelector("#window-realm");

  const error = page.locator(".state-line--error").first();
  await expect(error).toContainText(/Check your connection/, { timeout: 20000 });
  await expect(error).not.toContainText("Failed to fetch");

  // The raw text is separated, not discarded — it stays available for a bug
  // report rather than being shown as if it were the explanation.
  await expect(error).toHaveAttribute("title", /Failed to fetch/);
});
