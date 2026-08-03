import { test, expect, type Page } from "@playwright/test";

async function openBlockExplorer(page: Page) {
  await page.waitForSelector(".island__clock");
  await page.getByRole("button", { name: "Chain", exact: true }).hover();
  await page.locator(".island__popover").getByRole("button", { name: "Blocks", exact: true }).click();
  await page.mouse.move(0, 0);
  await expect(page.locator("#window-block-explorer")).toBeVisible();
}

/** "Only with txs" filtered the live feed, which cannot answer the question
 * on a quiet chain: measured on Topaz, none of the last 40 blocks held a
 * transaction and the most recent one that did was 554 blocks behind the
 * tip. So the filter always returned nothing and read as broken.
 *
 * The e2e network has no indexer on purpose, so this pins the honest
 * fallback: the app says what it cannot search rather than reporting an
 * empty result as if it had looked everywhere. */
test("with no indexer, the tx filter explains what it could not search", async ({ page }) => {
  await page.goto("/");
  await openBlockExplorer(page);

  await page.locator(".recent-activity__filter input").check();

  const pane = page.locator(".block-explorer__list-pane");
  await expect(pane).toContainText(/has no indexer/i);
  await expect(pane).toContainText(/only the blocks seen since this window opened/i);
  // Specifically NOT the old copy, which reported "none found" for a search
  // that had never been possible.
  await expect(pane).not.toContainText("No blocks with transactions in the current window yet.");
});

test("the filter is a toggle, and unchecking restores the live feed view", async ({ page }) => {
  await page.goto("/");
  await openBlockExplorer(page);

  const filter = page.locator(".recent-activity__filter input");
  await filter.check();
  await expect(page.locator(".block-explorer__list-pane")).toContainText(/has no indexer/i);

  await filter.uncheck();
  await expect(filter).not.toBeChecked();
  await expect(page.locator(".block-explorer__list-pane")).not.toContainText(/has no indexer/i);
});
