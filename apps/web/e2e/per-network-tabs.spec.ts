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
