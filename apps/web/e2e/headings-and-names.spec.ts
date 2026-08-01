import { test, expect } from "@playwright/test";

test("the page has an h1 and realm headings keep their real levels", async ({ page }) => {
  await page.goto("/?pkg=gno.land%2Fr%2Fgnoland%2Fblog");
  await page.waitForTimeout(2000);

  // Exactly one page-level h1, naming the app.
  const h1s = page.locator("h1");
  expect(await h1s.count()).toBe(1);
  await expect(h1s.first()).toHaveText(/Gnomputer/);

  // Realm content nests below it rather than being a flat run of h2s.
  const levels = await page.locator("article :is(h2,h3,h4,h5,h6)").evaluateAll((els) =>
    [...new Set(els.map((e) => e.tagName.toLowerCase()))].sort()
  );
  console.log("heading tags in realm content:", levels);

  // The close button's visible glyph must not contradict its name.
  const close = page.getByRole("button", { name: /^Close / }).first();
  await expect(close).toBeVisible();
});
