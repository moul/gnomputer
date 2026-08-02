import { test, expect } from "@playwright/test";

// The URL bar's "does this path resolve" check and the Render lens ran the
// same queryRender under two different query keys, so opening a realm on the
// Render lens fetched it twice (AUD-026).
test("opening a realm fetches its Render output once, not twice", async ({ page }) => {
  let renderCalls = 0;
  await page.route("**/127.0.0.1:26658/**", async (route) => {
    const post = route.request().postData() ?? "";
    if (post.includes("abci_query")) {
      try {
        const data = Buffer.from(
          (JSON.parse(post) as { params?: { data?: string } }).params?.data ?? "",
          "base64"
        ).toString();
        // qfile/qpaths are the source tree and package list, not Render.
        if (!data.includes("qfile") && !data.includes("qpaths")) renderCalls++;
      } catch {
        // Not a shape we care about counting.
      }
    }
    await route.continue();
  });

  await page.goto("/?pkg=gno.land/r/sys/users");
  await page.waitForSelector("#window-realm");
  await expect(page.locator(".realm-browser__lens-body")).not.toBeEmpty();
  // Long enough for a second, duplicate request to have landed if one were
  // still being made — measured at 2 before this change and 1 after.
  await page.waitForTimeout(4000);

  expect(renderCalls).toBe(1);
});
