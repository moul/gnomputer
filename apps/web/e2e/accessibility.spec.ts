import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Automated WCAG scanning (AUD-021). Nothing here replaces manual testing —
// axe catches roughly a third of real issues — but the third it catches is
// the third that silently reappears with every new screen.
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const THEMES = ["ascii-light", "ascii-cypherpunk", "modern-light", "modern-dark", "modern-minimal"];

// The island's app buttons, by accessible name.
const APPS = ["Browser", "Discover", "Resources", "Editor", "Shell", "Chain", "Settings"];

/** axe's own node list, rewritten into something a failure message can be
 * acted on from. The default output is a wall of JSON. */
function describeViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `[${violation.impact}] ${violation.id} @ ${node.target.join(" ")} — ${violation.help}`
    )
  );
}

for (const theme of THEMES) {
  test(`the desktop has no WCAG A/AA violations in ${theme}`, async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".island__clock");
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    // Colour transitions are ~120ms; scanning mid-cross-fade measures an
    // interpolated colour a shade off the token and produces failures that
    // don't reproduce on their own.
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(describeViolations(results.violations)).toEqual([]);
  });
}

for (const app of APPS) {
  test(`${app} has no WCAG A/AA violations`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    await page.waitForSelector(".island__clock");
    await page.locator(`.island button[aria-label="${app}"]`).click();

    // Some island buttons open a menu rather than a window; take the first
    // entry so the app itself is what gets scanned.
    const firstMenuItem = page.locator(".island-menu button").first();
    if (await firstMenuItem.isVisible().catch(() => false)) await firstMenuItem.click();
    await page.waitForSelector(".window__body", { state: "visible" });
    // Content arrives from the mock chain; scanning an empty shell would
    // pass without having looked at anything.
    await page.waitForTimeout(2500);

    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(describeViolations(results.violations)).toEqual([]);
  });
}
