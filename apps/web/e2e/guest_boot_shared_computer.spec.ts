import { test, expect } from "@playwright/test";
import { openApp } from "./open-app";

/** The spec's own promise for a first visit (§7.1): a live workspace, an
 * explanation of what you are looking at, and no wallet prompt.
 *
 * This spec used to be named after that promise while only checking the
 * toolbar, the absence of wallet copy, and one Settings message — so the
 * promise itself could break without failing anything (AUD-010).
 *
 * The explanation now lives in the Help app rather than in a note that
 * appeared once and vanished for good. What is asserted below is the promise,
 * not the surface: the lead line, a live workspace still visible behind it,
 * starters that actually open what they name, and nothing asking for a
 * wallet. */
const TIME_TO_USEFUL_WORKSPACE_MS = 15_000;

test("a guest lands in a live, explained workspace with no wallet prompt", async ({ page }) => {
  const startedAt = Date.now();
  await page.goto("/");

  // 1. The workspace is there, and it is the Browser — not a splash screen
  //    or an empty desktop.
  await expect(page.getByRole("toolbar", { name: "Apps" })).toBeVisible();
  const browser = page.locator("#window-realm");
  await expect(browser).toBeVisible();

  // 2. It says what this is. The exact lead line comes from the spec.
  const help = page.locator("#window-help");
  await expect(help).toBeVisible();
  await expect(help).toContainText("You are browsing the shared computer.");
  await expect(help).toContainText(/no wallet is needed/i);

  // 3. Help explains without hiding the thing it explains. A first visit has
  //    to show a LIVE workspace, so the introduction must not cover it.
  await expect(browser).toContainText("System realms");
  await expect(browser).toContainText("Recently active");
  await expect(browser.getByText("gno.land/r/sys/users")).toBeVisible();

  // 4. It is actually live. The realm lists above are curated, so they prove
  //    the UI rendered, not that any chain data arrived — the height does.
  await expect(page.locator('.island__clock .status-dot[data-state="connected"]')).toBeVisible();
  await page.locator(".island__clock").hover();
  await expect(page.locator(".island-menu--clock")).toContainText(/#[\d,]+/);
  await page.mouse.move(0, 0);

  // 5. Nothing asked for a wallet.
  await expect(page.getByText(/connect wallet/i)).toHaveCount(0);

  expect(Date.now() - startedAt).toBeLessThan(TIME_TO_USEFUL_WORKSPACE_MS);
});

test("the source of a realm is one step from the launch state", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#window-realm");
  // Out of the way, the way anyone would — it is an ordinary window now.
  await page.getByRole("button", { name: "Close Help" }).click();

  await page.locator("#window-realm").getByText("gno.land/r/sys/users").first().click();
  await expect(page.getByRole("tab", { name: /Source/i })).toBeVisible({ timeout: 15000 });
});

test("guest identity is explained in Settings, still without a wallet", async ({ page }) => {
  await page.goto("/");
  await openApp(page, "Settings");
  await page.getByRole("tab", { name: "User" }).click();
  await expect(
    page.locator("#window-settings").getByText(/browsing without a wallet/i)
  ).toBeVisible();
});

test("the launch state is in the same place every time", async ({ page }) => {
  // Windows a user opens are scattered deliberately, but a launch state that
  // moves a few dozen pixels on every load is not a launch state (AUD-009).
  // Reads the inline style, which comes straight from the window store,
  // rather than the painted box: the open animation means a bounding box
  // measured immediately is mid-flight and differs run to run for reasons
  // that have nothing to do with placement.
  const placement = () =>
    page.locator("#window-realm").evaluate((el) => {
      const style = (el as HTMLElement).style;
      return { left: style.left, top: style.top, width: style.width, height: style.height };
    });

  await page.goto("/");
  const first = await placement();
  await page.reload();
  await page.waitForSelector("#window-realm");
  expect(await placement()).toEqual(first);
});

/** The guide offers four things to DO, not four things to read. Each has to
 * actually open what it names — and unlike the note this replaced, a broken
 * step is now reachable forever rather than only on a visitor's very first
 * load, so it matters more that they keep working. */
test("each guide step opens what it says, and is ticked off", async ({ page }) => {
  await page.goto("/");
  const help = page.locator("#window-help");
  await expect(help).toBeVisible();

  const steps = help.locator(".help-window__list button");
  await expect(steps).toHaveCount(4);
  await expect(help.locator(".help-window__progress")).toHaveText("0/4");

  await steps.filter({ hasText: "Read its source" }).click();

  // The Source lens is the one showing, not merely the realm.
  await expect(page.getByRole("tab", { name: /Source/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#window-realm")).toContainText("r/sys/users", { timeout: 20_000 });
  // ...and the step records that it ran.
  await expect(help.locator(".help-window__progress")).toHaveText("1/4");
  await expect(steps.filter({ hasText: "Read its source" })).toHaveAttribute("data-done", "true");
});

test("a guide step can open an app, not just a realm", async ({ page }) => {
  await page.goto("/");
  const help = page.locator("#window-help");
  await help.locator(".help-window__list button").filter({ hasText: "Watch it change" }).click();
  await expect(page.locator("#window-event-explorer")).toBeVisible({ timeout: 20_000 });
});

/** The reason Help is an app and not a note: the note vanished on the first
 * stray click and never came back, so anything it had not yet explained
 * stayed unexplained. */
test("Help closes like any window and comes back from the island", async ({ page }) => {
  await page.goto("/");
  const help = page.locator("#window-help");
  await expect(help).toBeVisible();

  await page.getByRole("button", { name: "Close Help" }).click();
  await expect(help).toBeHidden();

  await openApp(page, "Help");
  await expect(help).toBeVisible();
  await expect(help).toContainText("You are browsing the shared computer.");
});

test("Help does not reopen itself for a returning visitor", async ({ page }) => {
  // Opening an unasked-for window on every load is the failure mode that
  // makes onboarding hated. One visit is one introduction.
  await page.goto("/");
  await expect(page.locator("#window-help")).toBeVisible();
  await page.getByRole("button", { name: "Close Help" }).click();
  await expect(page.locator("#window-help")).toBeHidden();

  await page.reload();
  await page.waitForSelector("#window-realm");
  // Given time to have reopened, if it were going to.
  await page.waitForTimeout(2000);
  await expect(page.locator("#window-help")).toBeHidden();
});

test("the action list reaches the tools, and each one opens", async ({ page }) => {
  await page.goto("/");
  const help = page.locator("#window-help");
  await help.getByRole("button", { name: /things to try/ }).click();
  await expect(help.locator(".help-window__heading")).toHaveText("Try something");

  await help.locator(".help-window__list button").filter({ hasText: "Simulate a call" }).click();
  await expect(page.locator("#window-shell")).toBeVisible({ timeout: 20_000 });
});
