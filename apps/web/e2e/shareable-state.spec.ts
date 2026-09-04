import { test, expect } from "@playwright/test";
import { openApp } from "./open-app";

// The URL carried only pkg and path, so a link to a realm's SOURCE opened on
// Render, and a link to a betanet realm opened on Topaz — showing a
// different chain's data under a right-looking URL (AUD-012).
test("a link carries the lens it was shared from", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/?pkg=gno.land/r/sys/users&lens=source");

  const win = page.locator("#window-realm");
  await expect(win.getByRole("tab", { name: "Source" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".realm-browser__lens-body")).toContainText("package users", {
    timeout: 15000,
  });
});

test("switching lens updates the URL, and the default lens leaves it out", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/?pkg=gno.land/r/sys/users&lens=source");
  await page.waitForSelector("#window-realm");

  const tabs = page.locator(".lens-tab-bar button, .realm-browser__lens-tabs button");

  await tabs.filter({ hasText: /^Raw$/ }).first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get("lens")).toBe("raw");

  // Render is the default, so it is omitted rather than written out — every
  // link shared before this parameter existed has to keep working.
  await tabs.filter({ hasText: /^Render$/ }).first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get("lens")).toBeNull();
  await expect.poll(() => new URL(page.url()).searchParams.get("pkg")).toBe(
    "gno.land/r/sys/users"
  );
});

test("a link can name the network, and it wins over the stored one", async ({ page }) => {
  await page.goto("/?net=betanet");
  await page.waitForSelector(".island__clock");

  await openApp(page, "Settings");
  await page.locator('#window-settings button:has-text("NETWORK")').first().click();
  await expect(page.locator("#window-settings select")).toHaveValue("betanet");
  await expect(page.locator(".network-recovery-banner")).toHaveCount(0);
});

test("a link naming a network that does not exist says so", async ({ page }) => {
  await page.goto("/?net=ghost-net");
  await page.waitForSelector(".island__clock");
  await expect(page.locator(".network-recovery-banner")).toContainText("ghost-net", {
    timeout: 10000,
  });
});

test("the network survives navigating around inside the app", async ({ page }) => {
  // The search object replaces the whole query string, so anything not
  // explicitly carried through is dropped. net was being dropped: open a
  // shared ?net=… link, click once, and the URL you could then copy sent
  // the next person to their own default network instead.
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/?net=betanet&pkg=gno.land/r/sys/users");
  await page.waitForSelector("#window-realm");
  expect(new URL(page.url()).searchParams.get("net")).toBe("betanet");

  const tabs = page.locator(".lens-tab-bar button, .realm-browser__lens-tabs button");
  await tabs.filter({ hasText: /^Raw$/ }).first().click();

  await expect.poll(() => new URL(page.url()).searchParams.get("lens")).toBe("raw");
  expect(new URL(page.url()).searchParams.get("net")).toBe("betanet");
  expect(new URL(page.url()).searchParams.get("pkg")).toBe("gno.land/r/sys/users");
});
