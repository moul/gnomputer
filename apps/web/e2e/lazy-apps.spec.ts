import { test, expect } from "@playwright/test";

// Apps are lazy-loaded (AUD-037); opening one must still work, and its chunk
// must not be fetched until the window actually opens.
test("a lazy app loads only when its window is opened", async ({ page }) => {
  const chunks: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/\/(src\/routes\/|assets\/).*(block-explorer|chain-stats)/.test(u)) chunks.push(u.split("/").pop()!);
  });

  await page.goto("/");
  await page.waitForSelector(".island");
  await page.waitForTimeout(1200);
  console.log("chunks before opening:", chunks.length);

  await page.getByRole("button", { name: "Chain", exact: true }).hover();
  // Scoped to the popover, not the page. Playwright matches accessible
  // names by substring, so a bare name:"Blocks" also matched the first-run
  // starter "Live events / Watch blocks land" the moment that shipped —
  // a strict-mode violation in a test that has nothing to do with either.
  await page.locator(".island__popover").getByRole("button", { name: "Blocks", exact: true }).click();
  await expect(page.locator(".window", { hasText: "Block" }).first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  console.log("chunks after opening:", chunks.length, chunks.slice(0, 3));
  expect(chunks.length).toBeGreaterThan(0);
});
