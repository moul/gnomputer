import { expect, type Page } from "@playwright/test";

/**
 * Closes the Help window, so a spec that is not about onboarding starts from
 * a returning visitor's desktop.
 *
 * Every Playwright context is a fresh browser profile, which means every spec
 * is somebody's first visit and Help opens itself. That is correct product
 * behaviour and wrong for most tests, in two distinct ways that both showed
 * up the moment Help landed:
 *
 * - It sits over the desktop, so a click aimed at the Browser's lens tabs
 *   underneath hits Help instead ("subtree intercepts pointer events"). The
 *   dismissible note this replaced avoided that with `pointer-events: none`
 *   and a comment saying an e2e had caught it; a real window cannot.
 * - It is a second open window, which changes behaviour that counts them —
 *   "Show all windows" is deliberately not offered for a single window, and
 *   Help quietly made it two.
 *
 * Call it after the `goto` whose page you are about to interact with. Safe to
 * call when Help is already closed.
 */
export async function dismissHelp(page: Page): Promise<void> {
  // Waits for it rather than checking once. Help opens itself only after an
  // async IndexedDB read resolves, so a bare visibility check right after
  // `goto` loses the race, returns early, and leaves the very window it was
  // meant to remove — which is exactly how this helper failed the first time.
  const help = page.locator("#window-help");
  try {
    await expect(help).toBeVisible({ timeout: 10_000 });
  } catch {
    // Genuinely already dismissed (a spec that reloads, say). Nothing to do.
    return;
  }
  await page.getByRole("button", { name: "Close Help" }).click();
  await expect(help).toBeHidden();
}
