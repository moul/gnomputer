import { test, expect, type Page } from "@playwright/test";

/** History has no island icon (hiddenFromIsland), so the palette is the
 * only deliberate way in — which is the point of #175. */
async function openHistory(page: Page) {
  await page.waitForSelector(".island__clock");
  await page.locator('.island button[aria-label*="command palette"]').click();
  await page.locator(".command-palette input").fill("history");
  await page.locator(".command-palette__apps button").first().click();
  await expect(page.locator("#window-history")).toBeVisible();
}

/** A Trail records where you have been. Until now it could be started and
 * renamed but never removed — "Clear history" starts a fresh one and leaves
 * the old rows behind — so the list only grew and what it recorded was
 * permanent for the life of the browser profile. For data the product calls
 * user-owned, that is the wrong default (AUD-045). */
test("a Trail can be deleted, and the last one is replaced rather than left absent", async ({
  page,
}) => {
  page.on("dialog", (d) => void d.accept());
  await page.goto("/?pkg=gno.land/r/sys/users");
  await openHistory(page);

  const rows = page.locator(".history-window__trail-list li");
  // Visible for a single Trail, not only for two or more: gating delete on
  // having started a second one puts it out of reach of the person most
  // likely to want it.
  await expect(rows).toHaveCount(1);

  await page.locator(".history-window__new-trail").click();
  await expect(rows).toHaveCount(2);

  await rows.first().locator(".history-window__trail-delete").click();
  await expect(rows).toHaveCount(1);

  // Deleting the last one leaves a fresh Trail active, not nothing — a null
  // active Trail makes the next page visit silently start an unnamed one,
  // which reads as the delete having failed.
  await rows.first().locator(".history-window__trail-delete").click();
  await expect(rows).toHaveCount(1);
  await expect(page.locator(".history-window__trail-name")).toBeVisible();
  await expect(page.locator(".history-window")).toContainText("Nothing visited yet");
});

test("the History window says where Trails are stored", async ({ page }) => {
  // Leaving someone to guess whether their browsing history is on a server
  // is not a neutral omission in a read-only, wallet-free app.
  await page.goto("/");
  await openHistory(page);
  await expect(page.locator(".history-window__scope")).toContainText(/stay in this browser/i);
  await expect(page.locator(".history-window__scope")).toContainText(/not.*uploaded|nothing here is uploaded/i);
});

test("a Trail exports as JSON", async ({ page }) => {
  await page.goto("/?pkg=gno.land/r/sys/users");
  await openHistory(page);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".history-window__trail-list .history-window__trail-action").first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^gnomputer-trail-.*\.json$/);
});
