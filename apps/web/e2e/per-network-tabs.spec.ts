import { test, expect } from "@playwright/test";

// A realm path names a package on one particular chain. It may be absent, or
// be a different package, on another — so tabs were showing the previous
// chain's realms while every query behind them went to the new chain.
//
// The e2e node answers any realm, so these assert the tab bookkeeping rather
// than the content: what is open, and what the address bar says.

async function switchNetwork(page: import("@playwright/test").Page, label: string) {
  await page.locator("button.island__status-item--network").click();
  await page.locator(".island-menu button", { hasText: label }).first().click();
}

test("switching network does not carry the previous chain's realm over", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/?pkg=gno.land/r/sys/users");

  const pathInput = page.locator("#window-realm input").first();
  await expect(pathInput).toHaveValue("gno.land/r/sys/users", { timeout: 15000 });

  await switchNetwork(page, "Betanet");

  // Betanet has nothing saved, so it opens at Home rather than inheriting a
  // realm that was only ever resolved against the other chain.
  await expect(pathInput).toHaveValue("", { timeout: 15000 });
  // The address bar follows the tabs, rather than still naming the realm from
  // the chain that was just left.
  await expect.poll(() => new URL(page.url()).searchParams.get("pkg")).toBeNull();
});

test("each network keeps its own open realm", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/?pkg=gno.land/r/sys/users");

  const pathInput = page.locator("#window-realm input").first();
  await expect(pathInput).toHaveValue("gno.land/r/sys/users", { timeout: 15000 });

  await switchNetwork(page, "Betanet");
  await expect(pathInput).toHaveValue("", { timeout: 15000 });

  // Coming back restores what that chain had open — the point of keying the
  // stored tabs by network rather than sharing one set.
  await switchNetwork(page, "Sapphire");
  await expect(pathInput).toHaveValue("gno.land/r/sys/users", { timeout: 15000 });
  await expect.poll(() => new URL(page.url()).searchParams.get("pkg")).toBe(
    "gno.land/r/sys/users"
  );
});

test("each network keeps its own set of open windows", async ({ page }) => {
  // Tabs alone were not enough: the desktop itself is per-chain. A Block
  // window sitting on a height, an Address window on an account — neither
  // means anything once pointed at a different chain.
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  // Both of these are in the switcher, unlike the network the e2e override
  // starts on — so each one has a desktop of its own to save and restore.
  await switchNetwork(page, "Topaz");

  const settings = page.locator("#window-settings");
  await page.locator("button.island__icon[aria-label='Settings']").click();
  await expect(settings).toBeVisible();

  // Bring another window to the front, so Settings is open but not what the
  // switch is carrying — otherwise this would only be testing the carry.
  await page.locator("#window-realm").click({ position: { x: 10, y: 10 } });

  await switchNetwork(page, "Betanet");
  // Betanet has its own desktop, and Settings was never opened on it.
  await expect(settings).toBeHidden({ timeout: 15000 });

  await switchNetwork(page, "Topaz");
  // Topaz still has it, because the desktop was saved against that chain.
  await expect(settings).toBeVisible({ timeout: 15000 });
});

test("the window you are in survives the switch", async ({ page }) => {
  // The network picker lives in Settings, so a per-network desktop would
  // otherwise close the window being used at the moment it is used.
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const settings = page.locator("#window-settings");
  await page.locator("button.island__icon[aria-label='Settings']").click();
  await expect(settings).toBeVisible();

  await switchNetwork(page, "Betanet");

  await expect(settings).toBeVisible({ timeout: 15000 });
});

test("switching shows a boot overlay rather than windows blinking out", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  await page.locator("button.island__status-item--network").click();
  await page.locator(".island-menu button", { hasText: "Betanet" }).first().click();

  // The desktop is genuinely torn down and rebuilt, which without cover reads
  // as the app glitching at the moment the user is least sure what happened.
  const overlay = page.locator(".network-switch");
  await expect(overlay).toContainText("Switching to Betanet");
  await expect(overlay).toBeHidden({ timeout: 15000 });
});

test("the overlay still shows on a switch that restores instantly", async ({ page }) => {
  // The cold path is slow enough to be safe. The risk is the warm one: a
  // layout already in the page cache can restore inside the same React batch
  // that started the switch, so anything watching only the "switching"
  // boolean sees it go true and back to false without rendering in between,
  // and the overlay silently never appears.
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  await switchNetwork(page, "Betanet");
  await expect(page.locator(".network-switch")).toBeHidden({ timeout: 15000 });

  // Second switch: both layouts have now been read once.
  await page.locator("button.island__status-item--network").click();
  await page.locator(".island-menu button", { hasText: "Topaz" }).first().click();

  await expect(page.locator(".network-switch")).toContainText("Switching to Topaz");
});

test("the network switcher is reachable from the island, and names the current chain", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/");

  // Short label: the qualifier is dropped, since it is the same for most
  // entries and costs island width without telling them apart. Under the e2e
  // override the active network is "Mock (e2e)", so this also exercises the
  // fallback for a network carrying no explicit shortName.
  const trigger = page.locator("button.island__status-item--network");
  await expect(trigger).toHaveText(/Mock/);
  await expect(trigger).not.toHaveText(/\(e2e\)/);
  // The full name is still reachable, just not spent on the label.
  await expect(trigger).toHaveAttribute("title", /Mock \(e2e\)/);

  // Changing chain used to mean opening Settings and finding the Network tab.
  await trigger.click();
  const menu = page.locator(".island-menu");
  for (const label of ["Sapphire", "Topaz", "Betanet", "gnodev"]) {
    await expect(menu.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
});
