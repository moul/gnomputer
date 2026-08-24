import { test, expect } from "@playwright/test";

// The mock node answers these two paths with a real VM refusal — an HTTP 200
// carrying ResponseBase.Error — rather than a render. Until it could, nothing
// exercised the app's error branches end to end: the RPC package's typed
// errors were covered by unit tests, but what the browser *does* with them
// (gray out a lens, name a missing realm) was not.
const NO_RENDER = "gno.land/p/mock/norender";
const MISSING = "gno.land/r/mock/missing";

test("a package with no Render() grays out the lens and falls back to Source", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto(`/?pkg=${NO_RENDER}`);

  const win = page.locator("#window-realm");
  // Not an error state: there is nothing to retry, the package simply has no
  // Render to show.
  await expect(
    win.getByRole("tab", { name: "Source", exact: true })
  ).toHaveAttribute("aria-selected", "true", { timeout: 15000 });
  await expect(win.getByRole("tab", { name: "Render", exact: true })).toBeDisabled();
  await expect(page.locator(".realm-browser__lens-body")).not.toContainText("Could not load");
});

test("a realm that does not exist is named, not reported as a network failure", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto(`/?pkg=${MISSING}`);

  // The distinction matters: "check your connection" sends the reader to fix
  // something that is not broken, and offers a retry that can never succeed.
  await expect(page.locator("#window-realm")).toContainText(MISSING, { timeout: 15000 });
  await expect(page.locator("#window-realm")).not.toContainText("Check your connection");
});

// Restoring persisted tabs is asynchronous, and it merges saved windows over
// whatever is already in the store — including the tab this component had just
// derived from the URL. So a shared link opened the recipient's own last-used
// realm instead, under the linked realm's title, with no error: the window
// title said one thing and the tab bar, address bar and content said another.
// Anyone who had ever opened a realm was affected; only a first-ever visit worked.
test("a shared link wins over the tab restored from a previous visit", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });

  // First visit, which persists a tab.
  await page.goto("/?pkg=gno.land/r/sys/users");
  await expect(page.locator("#window-realm")).toContainText("gno.land/r/sys/users", {
    timeout: 15000,
  });

  // Second visit is a cold load with that tab already stored — the case that
  // regressed. A different realm, so a stale tab is unmistakable.
  await page.goto(`/?pkg=${MISSING}`);

  const pathInput = page.locator("#window-realm input").first();
  await expect(pathInput).toHaveValue(MISSING, { timeout: 15000 });
  await expect(page.locator("#window-realm").getByRole("tab").first()).toContainText("r/mock/missing");
});

test("opening the app with no link still restores the previous tab", async ({ page }) => {
  // The other half of the same rule: a link names what to show, a bare visit
  // resumes. Fixing the first must not turn every cold start into a reset.
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/?pkg=gno.land/r/sys/users&lens=source");
  await expect(page.locator("#window-realm").getByRole("tab", { name: "Source" })).toHaveAttribute(
    "aria-selected",
    "true",
    { timeout: 15000 }
  );

  // Persisting is a fire-and-forget IndexedDB write, so navigating as soon as
  // the tab renders can outrun it and leave nothing to restore — which looks
  // exactly like the bug this guards against.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open("gnomputer");
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          // Tabs are stored per network (`realm-tabs:<networkId>`), and the
          // e2e override decides which id that is — so match on the prefix
          // rather than naming a network here.
          return new Promise<string>((resolve) => {
            const req = db.transaction("meta", "readonly").objectStore("meta").getAll();
            req.onsuccess = () =>
              resolve(
                (req.result as { key?: string; value?: string }[])
                  .filter((row) => String(row.key ?? "").startsWith("uiState:realm-tabs"))
                  .map((row) => String(row.value ?? ""))
                  .join("")
              );
            req.onerror = () => resolve("");
          });
        }),
      { timeout: 15000 }
    )
    .toContain("gno.land/r/sys/users");

  await page.goto("/");
  const pathInput = page.locator("#window-realm input").first();
  await expect(pathInput).toHaveValue("gno.land/r/sys/users", { timeout: 15000 });
});
