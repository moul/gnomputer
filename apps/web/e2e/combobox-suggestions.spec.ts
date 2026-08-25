import { test, expect } from "@playwright/test";

// #197: the realm-path suggestions were a native `<datalist>`, whose popup the
// browser draws outside the page. A long path was cut off at the right edge,
// hiding the part that identifies the realm — and it could not be fixed or
// even verified, because the popup does not appear in the DOM or a screenshot.
//
// These assert what that made impossible: the options are real elements.

test("realm suggestions are inspectable elements, not a browser-drawn popup", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/");
  await page.waitForSelector("#window-realm");

  const input = page.locator("#window-realm input[role=combobox]");
  await input.click();
  await input.fill("gno.land/r/");

  const listbox = page.locator("#window-realm [role=listbox]");
  await expect(listbox.getByRole("option").first()).toBeVisible({ timeout: 15000 });

  // What a datalist could never give: the rendered text is ours, and the full
  // path is reachable even when the label is elided.
  const first = listbox.getByRole("option").first();
  const title = await first.getAttribute("title");
  expect(title).toContain("gno.land/");
});

test("the suggestion list is navigable by keyboard and commits the full path", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/");
  await page.waitForSelector("#window-realm");

  const input = page.locator("#window-realm input[role=combobox]");
  await input.click();
  await input.fill("gno.land/r/");
  await expect(page.locator("#window-realm [role=listbox]").getByRole("option").first()).toBeVisible(
    { timeout: 15000 }
  );

  await input.press("ArrowDown");
  // The highlighted option is named through aria-activedescendant, which is
  // how a screen reader follows a combobox — focus stays in the input.
  await expect
    .poll(() => input.getAttribute("aria-activedescendant"))
    .not.toBeNull();

  await input.press("Enter");

  // Commits the whole path, not the shortened label that was displayed.
  await expect.poll(() => input.inputValue()).toMatch(/^gno\.land\//);
});

test("Escape closes the suggestions and still closes the palette", async ({ page }) => {
  // The ARIA pattern would swallow the first Escape to close only the list.
  // Inside the command palette that reads as the key having been ignored.
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  await page.locator('.island button[aria-label*="command palette"]').click();
  const input = page.locator(".command-palette input[role=combobox]");
  await input.fill("gno.land/r/");
  await expect(page.locator(".command-palette [role=option]").first()).toBeVisible({
    timeout: 15000,
  });

  await input.press("Escape");
  await expect(page.locator(".command-palette")).toHaveCount(0);
});
