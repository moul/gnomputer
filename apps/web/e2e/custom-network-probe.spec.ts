import { test, expect } from "@playwright/test";
import { openApp } from "./open-app";

// Adding a custom network used to accept any http(s) URL, save it with
// chainId "unknown", and switch to it — with nothing confirming the endpoint
// existed, spoke Gno, or was the chain the user meant. And since signing
// refuses a chain ID of "unknown", every custom network was permanently
// unable to sign (AUD-027).
test("a custom network is checked before it is saved, and its chain ID is read from it", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector(".island__clock");
  await openApp(page, "Settings");
  await page.locator('#window-settings button:has-text("NETWORK")').first().click();

  const name = page.locator("#window-settings input").nth(0);
  const rpcUrl = page.locator("#window-settings input").nth(1);
  const submit = page.locator(
    '#window-settings button:has-text("Check and add"), #window-settings button:has-text("Checking the endpoint")'
  );

  // Something that answers but is not a Gno RPC must not be saved.
  await name.fill("Bogus");
  await rpcUrl.fill("https://example.com");
  await submit.click();
  await expect(page.locator('#window-settings [role="alert"]')).toBeVisible();
  await expect(page.locator("#window-settings select option")).toHaveCount(3);

  // A real endpoint is saved, tagged local, and shows the chain ID it
  // reported rather than "unknown".
  await name.fill("Mocky");
  await rpcUrl.fill("http://127.0.0.1:26658");
  await submit.click();

  const row = page.locator("#window-settings li", { hasText: "Mocky" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("chain test-13");
  await expect(row).toContainText("local");
  await expect(page.locator("#window-settings select")).toHaveValue("custom-mocky");
});
