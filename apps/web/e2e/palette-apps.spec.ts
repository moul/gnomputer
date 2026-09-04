import { test, expect } from "@playwright/test";
import { dismissHelp } from "./dismiss-help";

// The README says "unopened apps live behind the island bar's icons and a
// command palette (⌘K)". The island half was true; the palette only ever
// resolved entities, so you could not reach a single app from it — a false
// capability claim as much as a missing feature (AUD-046).
async function openPalette(page: import("@playwright/test").Page) {
  await page.locator('.island button[aria-label*="command palette"]').click();
  return page.locator(".command-palette input");
}

test("an app can be found and opened from the palette", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const input = await openPalette(page);
  await input.fill("editor");
  await expect(page.locator(".command-palette__apps button")).toHaveText([/Editor/]);

  await input.press("Enter");
  await expect(page.locator("#window-editor")).toBeVisible();
  await expect(page.locator(".command-palette")).toHaveCount(0);
});

test("apps with no island icon are reachable here", async ({ page }) => {
  // These are otherwise reachable only contextually — a trail step, an
  // entity link — so the palette is the one place to find them on purpose.
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const input = await openPalette(page);
  await input.fill("governance");
  await page.locator(".command-palette__apps button").first().click();
  await expect(page.locator("#window-governance")).toBeVisible();
});

test("an address still resolves as an entity, not an app", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const input = await openPalette(page);
  await input.fill("g1manfred47kzduec920z88wfr64ylksmdcedlf5");
  await expect(page.locator(".command-palette__apps button")).toHaveCount(0);
});

/** The last third of AUD-046: the palette runs commands, not only
 * lookups. These assert the observable EFFECT rather than that a row was
 * clicked — a command that renders and does nothing is the failure mode
 * worth catching, and it looks identical from the palette's side. */
test("a theme command actually repaints the app", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");
  const before = await page.locator("html").getAttribute("data-theme");

  const input = await openPalette(page);
  await input.fill("cypherpunk");
  await page.locator(".command-palette__commands button").first().click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "ascii-cypherpunk");
  expect(before).not.toBe("ascii-cypherpunk");
  await expect(page.locator(".command-palette")).toHaveCount(0);
});

test("a command is reachable by a keyword that is not in its label", async ({ page }) => {
  // "appearance" appears nowhere in "Settings: Theme". Keywords exist so
  // the palette answers to the word you actually reach for.
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const input = await openPalette(page);
  await input.fill("appearance");
  await page.locator(".command-palette__commands button").filter({ hasText: "Theme" }).first().click();
  await expect(page.locator("#window-settings")).toBeVisible();
});

test("zoom commands change the desktop scale and put it back", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");
  const zoom = () => page.evaluate(() => (document.querySelector(".desktop") as HTMLElement | null)?.style.zoom || "1");

  let input = await openPalette(page);
  await input.fill("zoom in");
  await page.locator(".command-palette__commands button").first().click();
  expect(Number(await zoom())).toBeGreaterThan(1);

  input = await openPalette(page);
  await input.fill("reset zoom");
  await page.locator(".command-palette__commands button").first().click();
  expect(Number(await zoom())).toBe(1);
});

test("an empty palette lists nothing, and one keystroke does not list everything", async ({
  page,
}) => {
  // There are ~15 commands. Dumping them on open would bury the entity
  // lookup this palette is mostly used for, and every result list here is
  // capped for the same reason.
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const input = await openPalette(page);
  await expect(page.locator(".command-palette__commands button")).toHaveCount(0);

  await input.fill("e");
  const rows = page.locator(".command-palette__commands button");
  expect(await rows.count()).toBeLessThanOrEqual(5);
});

// Exclusion of the network you're already on is asserted in
// palette-commands.test.ts, not here: the e2e suite runs against the mock
// network, which is not in the switchable list at all, so any assertion
// about it here would pass without exercising the rule.

test("a command that could not act is not offered at all", async ({ page }) => {
  // Overview refuses to engage with one window — one tile is not an
  // overview. Listing it anyway gave a palette row that did nothing when
  // clicked, which is indistinguishable from a broken command.
  await page.goto("/");
  await page.waitForSelector(".island__clock");
  // The premise below is "one open window". Help opens itself on a first
  // visit, and every Playwright context is one, which made it two.
  await dismissHelp(page);

  let input = await openPalette(page);
  await input.fill("show all windows");
  await expect(page.locator(".command-palette__commands button")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Open a second window, and it appears.
  input = await openPalette(page);
  await input.fill("editor");
  await input.press("Enter");
  await expect(page.locator("#window-editor")).toBeVisible();

  input = await openPalette(page);
  await input.fill("show all windows");
  await expect(page.locator(".command-palette__commands button")).toHaveCount(1);
});

test("closing the palette empties it, however it was closed", async ({ page }) => {
  // Running a command already cleared the box; Escape and clicking away did
  // not, so ⌘K could reopen onto a stale query and a stale result list for
  // something already done.
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  let input = await openPalette(page);
  await input.fill("zoom");
  await expect(page.locator(".command-palette__commands button").first()).toBeVisible();
  await page.keyboard.press("Escape");

  input = await openPalette(page);
  await expect(input).toHaveValue("");
  await expect(page.locator(".command-palette__commands button")).toHaveCount(0);

  // Same for dismissing by clicking the backdrop.
  await input.fill("zoom");
  await page.locator(".command-palette").click({ position: { x: 5, y: 5 } });
  input = await openPalette(page);
  await expect(input).toHaveValue("");
});
