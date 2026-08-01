import { test, expect } from "@playwright/test";
import { openApp } from "./open-app";

/** The spec's own promise for a first visit (§7.1): a live workspace, an
 * explanation of what you are looking at, and no wallet prompt.
 *
 * This spec used to be named after that promise while only checking the
 * toolbar, the absence of wallet copy, and one Settings message — so the
 * promise itself could break without failing anything (AUD-010). */
const TIME_TO_USEFUL_WORKSPACE_MS = 15_000;

test("a guest lands in a live, explained workspace with no wallet prompt", async ({ page }) => {
  const startedAt = Date.now();
  await page.goto("/");

  // 1. The workspace is there, and it is the Browser — not a splash screen,
  //    a modal, or an empty desktop.
  await expect(page.getByRole("toolbar", { name: "Apps" })).toBeVisible();
  const browser = page.locator("#window-realm");
  await expect(browser).toBeVisible();

  // 2. It says what this is. The exact lead line comes from the spec.
  const note = page.locator(".first-run-note");
  await expect(note).toContainText("You are browsing the shared computer.");
  await expect(note).toContainText(/no wallet is needed/i);

  // 3. The launch state offers somewhere to go: realms to open, and a
  //    recent-activity section. (These headings render uppercase via CSS,
  //    so the DOM text is sentence case — asserting the painted form would
  //    pass for the wrong reason.)
  await expect(browser).toContainText("System realms");
  await expect(browser).toContainText("Recently active");
  await expect(browser.getByText("gno.land/r/sys/users")).toBeVisible();

  // 4. It is actually live. The realm lists above are curated, so they
  //    prove the UI rendered, not that any chain data arrived — the height
  //    does.
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
  await page.locator(".first-run-note__dismiss").click();

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
