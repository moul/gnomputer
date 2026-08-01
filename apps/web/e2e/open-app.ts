import { expect, type Page } from "@playwright/test";

/** Opens an app from the island bar and gets the popover out of the way.
 *
 * Clicking an island icon opens the window but leaves the popover showing —
 * it is hover-driven, and the pointer is still on the icon. The popover is
 * positioned over the desktop, so the very next click on the window it just
 * opened can land on the popover instead. Locally the popover usually fades
 * before the next action; in CI it does not, and the failure reads as
 * "element is not stable" or "<div class='island-menu'> intercepts pointer
 * events" on a control that is plainly visible.
 *
 * Moving the pointer off the island is what actually closes it, so this
 * waits for that rather than assuming a timeout is enough. */
export async function openApp(page: Page, label: string): Promise<void> {
  await page.locator(`.island button[aria-label="${label}"]`).click();
  await page.mouse.move(0, 0);
  await expect(page.locator(".island__popover")).toHaveCount(0);
}
