import { test, expect } from "@playwright/test";

// safe-url.ts has unit tests, but the property that matters is the
// integration: does every place that turns realm output into DOM actually
// go through it? A new node type, or a second render path, could bypass the
// allowlist without failing a single unit test (AUD-030).
//
// Realm Render() output is authored by whoever deployed the realm. This is
// the untrusted input.
function abciResponse(markdown: string) {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      response: {
        ResponseBase: { Data: Buffer.from(markdown).toString("base64"), Error: null },
      },
    },
  };
}

const SAFE_LINK = "https://ok.test/fine";
const HOSTILE = [
  "[a](javascript:alert(1))",
  "[b](JaVaScRiPt:alert(2))",
  // Control characters splitting the scheme — rejected, not normalised.
  "[c](java\nscript:alert(3))",
  "[d](data:text/html,<script>alert(4)</script>)",
  "[e](vbscript:msgbox(5))",
  // Credentials before the host: reads as real.test, goes to evil.test.
  "[f](https://evil.test@real.test/path)",
  "[g](  javascript:alert(7))",
  "<img src=x onerror=alert(8)>",
  "<script>window.__pwned=1</script>",
  `[h](${SAFE_LINK})`,
].join("\n\n");

test("hostile realm markup cannot execute or produce a dangerous link", async ({ page }) => {
  test.setTimeout(60_000);
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await page.route("**/127.0.0.1:26658/**", async (route) => {
    const post = route.request().postData() ?? "";
    if (post.includes("abci_query")) {
      const data = Buffer.from(
        (JSON.parse(post) as { params?: { data?: string } }).params?.data ?? "",
        "base64"
      ).toString();
      if (!data.includes("qfile") && !data.includes("qpaths")) {
        return route.fulfill({ json: abciResponse(HOSTILE) });
      }
    }
    await route.continue();
  });

  await page.goto("/?pkg=gno.land/r/sys/users");
  await page.waitForSelector("#window-realm");
  // The payload has to actually render, or this asserts nothing.
  await expect(page.locator(`#window-realm a[href="${SAFE_LINK}"]`)).toBeVisible({
    timeout: 20_000,
  });

  // Exactly one link survives: the legitimate one. Everything else is
  // rendered as text, not as a destination.
  const hrefs = await page
    .locator("#window-realm a")
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")));
  expect(hrefs).toEqual([SAFE_LINK]);

  expect(dialogs).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  await expect(page.locator("#window-realm script")).toHaveCount(0);
  await expect(page.locator("#window-realm img")).toHaveCount(0);
});
