import { test, expect } from "@playwright/test";

// Realm Render() output is written by whoever deployed the realm, so its
// SIZE is untrusted too, not just its content. XSS is handled (safe-url.ts);
// this covers the other way chain-authored content can hurt you — making
// the tab unusable.
//
// The app handles all of these today. The test exists so it keeps doing so:
// a heavier markdown renderer, or per-node work added to the render path,
// would turn "any realm author can freeze your browser" into a regression
// nobody notices until someone does it.
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

const PAYLOADS: [string, string, number][] = [
  ["a megabyte of text", "x".repeat(1_000_000), 900_000],
  [
    "fifty thousand links",
    Array.from({ length: 50_000 }, (_, i) => `[l${i}](https://example.test/${i})`).join(" "),
    300_000,
  ],
  ["five thousand levels of nesting", "> ".repeat(5000) + "deep", 1000],
  [
    "a hundred thousand lines",
    Array.from({ length: 100_000 }, (_, i) => `line ${i}`).join("\n"),
    900_000,
  ],
];

for (const [name, markdown, minRenderedChars] of PAYLOADS) {
  test(`${name} does not make the app unusable`, async ({ page }) => {
    test.setTimeout(90_000);
    const crashes: string[] = [];
    page.on("pageerror", (error) => crashes.push(error.message));

    await page.route("**/127.0.0.1:26658/**", async (route) => {
      const post = route.request().postData() ?? "";
      if (post.includes("abci_query")) {
        const data = Buffer.from(
          (JSON.parse(post) as { params?: { data?: string } }).params?.data ?? "",
          "base64"
        ).toString();
        if (!data.includes("qfile") && !data.includes("qpaths")) {
          return route.fulfill({ json: abciResponse(markdown) });
        }
      }
      await route.continue();
    });

    await page.goto("/?pkg=gno.land/r/sys/users");
    await page.waitForSelector("#window-realm");

    // The payload must actually reach the renderer, or this asserts nothing.
    await expect
      .poll(
        async () => (await page.locator(".realm-browser__lens-body").innerText().catch(() => "")).length,
        { timeout: 45_000 }
      )
      .toBeGreaterThan(minRenderedChars);

    // The real question: can you still use the app?
    await page.locator('.island button[aria-label="Settings"]').click({ timeout: 30_000 });
    await expect(page.locator("#window-settings")).toBeVisible();
    expect(crashes).toEqual([]);
  });
}
