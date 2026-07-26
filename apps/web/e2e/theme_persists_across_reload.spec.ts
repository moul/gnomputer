import { test, expect } from "@playwright/test";

test("a chosen theme survives a reload, including the painted data-theme attribute", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).hover();
  await page.getByRole("button", { name: /Theme/ }).click();
  await page.getByRole("button", { name: /Cypherpunk/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ascii-cypherpunk");

  await page.reload();

  // The real risk use-theme-persistence.ts calls out: restoring via a raw
  // setState (not setTheme) would update the store without ever repainting
  // the data-theme attribute a fresh load starts with — so the DOM
  // attribute itself, not just app state, is what this asserts.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ascii-cypherpunk");
  await page.getByRole("button", { name: "Settings", exact: true }).hover();
  await page.getByRole("button", { name: /Theme/ }).click();
  await expect(page.getByRole("button", { name: /Cypherpunk/ })).toHaveAttribute("data-active", "true");
});
