import { test, expect } from "@playwright/test";

// The docs sidebar was nested <ul>s of <button>s: no tree semantics at all,
// and one tab stop per folder toggle and per file. A few-hundred-entry
// listing meant a few hundred Tabs to cross (AUD-020).
test("the docs tree is one tab stop with real tree semantics and APG keys", async ({ page }) => {
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({
      json: route.request().url().includes("sha1")
        ? {
            tree: [
              { path: "adr/ADR-001.md", type: "blob" },
              { path: "adr/ADR-002.md", type: "blob" },
              { path: "readme.md", type: "blob" },
            ],
          }
        : { tree: [{ path: "docs", type: "tree", sha: "sha1" }] },
    })
  );
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({ body: "# Hello doc" })
  );

  await page.goto("/");
  await page.locator('button:has-text("📚")').first().click();

  const tree = page.locator('[role="tree"]');
  await expect(tree).toBeVisible({ timeout: 15000 });
  const rows = tree.locator('[role="treeitem"]');
  await expect(rows).toHaveCount(4);

  // The whole tree is a single tab stop, not one per row.
  await expect(tree.locator('[tabindex="0"]')).toHaveCount(1);

  await rows.first().focus();
  await page.keyboard.press("ArrowLeft");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAttribute("aria-expanded", "false");

  // Right expands, and a second Right steps *into* the folder rather than
  // toggling it shut again.
  await page.keyboard.press("ArrowRight");
  await expect(rows.first()).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowRight");
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe(
    "ADR-001.md"
  );

  await page.keyboard.press("Enter");
  await expect(tree.locator('[aria-selected="true"]')).toHaveCount(1);
  await expect(page.locator(".markdown-body").first()).toContainText("Hello doc");

  // Typeahead — arrowing to the bottom of a real docs listing is a long trip.
  await page.keyboard.press("r");
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe(
    "readme.md"
  );
});
