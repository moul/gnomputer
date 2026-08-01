import { test, expect } from "@playwright/test";

// The connection dot is aria-hidden and the clock's accessible name is only
// read when focused, so before this the chain could drop and a screen reader
// user would never be told. Guards both halves of the rule: a healthy boot
// must stay silent, and a drop must be spoken.
test("the connection live region is silent on a healthy boot and speaks on a drop", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");

  const region = page.locator('[role="status"][aria-live="polite"]').first();
  await expect(region).toHaveText("");

  // Every chain call is a JSON-RPC POST; killing them is the closest thing
  // to the chain going away without touching the page's own assets.
  await page.route("**/*", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue()
  );

  await expect(region).toHaveText(/Not connected to the chain/, { timeout: 20000 });
});
