import { test, expect } from "@playwright/test";

// The dialogs declared aria-modal="true" but nothing constrained Tab, so
// focus walked out into the windows behind them, and on close it was
// dropped on <body> (AUD-019).
test("the command palette traps Tab and restores focus on close", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island");

  // Give focus to a known element first, so restoration is observable.
  const opener = page.getByRole("button", { name: "Open command palette (Cmd+K)" });
  await opener.focus();
  await expect(opener).toBeFocused();

  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();

  // Focus moved INTO the dialog rather than staying behind it.
  const inside = await page.evaluate(() =>
    !!document.querySelector('[role=dialog]')?.contains(document.activeElement)
  );
  expect(inside).toBe(true);

  // Tab repeatedly: focus must never leave the dialog.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const stillInside = await page.evaluate(() =>
      !!document.querySelector('[role=dialog]')?.contains(document.activeElement)
    );
    expect(stillInside).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  // Focus went back to the opener, not to <body>.
  await expect(opener).toBeFocused();
});
