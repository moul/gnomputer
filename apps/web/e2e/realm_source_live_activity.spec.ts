import { test, expect } from "@playwright/test";

test("opening a realm renders it, with Source reachable as a lens tab", async ({ page }) => {
  await page.goto("/?pkg=gno.land%2Fr%2Fgnoland%2Fblog");
  await expect(page.getByRole("article")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("tab", { name: "Source" }).click();
  await expect(page.getByRole("navigation", { name: "File tree" })).toBeVisible({ timeout: 15_000 });
});
