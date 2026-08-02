import { test, expect } from "@playwright/test";

// A captive portal, a proxy error page, or a truncated response all reach
// the app as a JSON parse failure. The parser's own wording ("Unterminated
// string in JSON at position 21") describes the bytes rather than the
// problem, and reads like a bug in this app instead of a bad endpoint
// (AUD-035).
const RESPONSES: [string, { status: number; contentType: string; body: string }][] = [
  ["a captive portal's HTML", { status: 200, contentType: "text/html", body: "<html>login</html>" }],
  ["an empty body", { status: 200, contentType: "application/json", body: "" }],
  ["a truncated body", { status: 200, contentType: "application/json", body: '{"jsonrpc":"2.0","res' }],
];

for (const [name, response] of RESPONSES) {
  test(`${name} is explained, not echoed`, async ({ page }) => {
    const crashes: string[] = [];
    page.on("pageerror", (e) => crashes.push(e.message));
    await page.route("**/127.0.0.1:26658/**", (route) => route.fulfill(response));

    await page.goto("/?pkg=gno.land/r/sys/users");
    await page.waitForSelector("#window-realm");

    const error = page.locator(".state-line--error").first();
    await expect(error).toContainText(/isn't valid JSON/, { timeout: 20_000 });
    await expect(error).toContainText(/may not be an RPC endpoint/);
    // The parser's own text must not be what the user reads.
    await expect(error).not.toContainText("position");
    await expect(error).not.toContainText("Unexpected token");

    // And the app must survive it.
    expect(crashes).toEqual([]);
    await expect(page.locator(".island__clock")).toBeVisible();
  });
}
