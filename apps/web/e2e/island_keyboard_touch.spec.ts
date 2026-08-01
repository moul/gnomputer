import { test, expect } from "@playwright/test";

// Before this, island popovers opened on mouseenter only, and the Discover
// and clock triggers were non-focusable <div>s — so the whole island
// navigation was unreachable by keyboard and by touch (AUD-014).
test("island menus open on keyboard focus and close on Escape", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island");

  const chain = page.getByRole("button", { name: "Chain", exact: true });
  await expect(chain).toHaveAttribute("aria-haspopup", "menu");
  await expect(chain).toHaveAttribute("aria-expanded", "false");

  await chain.focus();
  const panel = page.locator(".island__popover");
  await expect(panel).toBeVisible();
  await expect(chain).toHaveAttribute("aria-expanded", "true");
  // Menu items are reachable, not just visible.
  await expect(panel.getByRole("button", { name: "Event Explorer" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(chain).toBeFocused();
});

test("Discover and the clock are focusable buttons, not inert divs", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island");

  for (const name of [/Discover/, /Clock and connection status/]) {
    const trigger = page.getByRole("button", { name });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await expect(page.locator(".island__popover")).toBeVisible();
    await page.keyboard.press("Escape");
  }
});

test("tapping a trigger opens the menu (touch has no hover)", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island");

  const discover = page.getByRole("button", { name: /Discover/ });
  await discover.dispatchEvent("click");
  await expect(page.locator(".island__popover")).toBeVisible();

  // Tapping outside dismisses — there is no pointerleave on touch.
  await page.mouse.click(700, 700);
  await expect(page.locator(".island__popover")).toHaveCount(0);
});
