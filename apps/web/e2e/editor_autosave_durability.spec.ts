import { test, expect } from "@playwright/test";

// Regression guard for the autosave data-loss bug (#93 / AUD-005): edits made
// inside the 600ms debounce window were discarded, rejected writes were
// swallowed, and nothing told the user whether their work was saved.
test("editor shows save state and persists an explicitly saved edit", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/");
  await page.waitForSelector(".island");
  await page.getByRole("button", { name: "Editor", exact: true }).click();

  const win = page.locator(".editor-window");
  await expect(win).toBeVisible();

  // Create a script from the first available template.
  await win.locator("nav[aria-label='Scripts'] .editor-window__new").click();
  await win.locator(".editor-window__main button").first().click();
  await expect(win.locator(".editor-window__name")).toBeVisible();
  const scriptName = await win.locator(".editor-window__name").innerText();

  const editor = win.locator(".cm-content");
  await editor.click();
  const marker = `// durability-${Date.now()}`;
  await page.keyboard.type(marker);

  // The dirty indicator must appear immediately — previously there was no
  // save state at all.
  await expect(win.locator(".editor-window__save-state")).toBeVisible();

  // Cmd/Ctrl+S flushes right away instead of waiting for the debounce.
  await page.keyboard.press("ControlOrMeta+s");
  await expect(win.locator(".editor-window__save-state[data-state='saved']")).toBeVisible({
    timeout: 10_000,
  });

  // Durability across a full reload.
  await page.reload();
  await page.waitForSelector(".island");
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  await win.locator(`nav[aria-label='Scripts'] ul button:has-text("${scriptName}")`).first().click();
  await expect(win.locator(".cm-content")).toContainText(marker, { timeout: 10_000 });
});

// The precise data-loss path: an edit made inside the debounce window, then
// the Editor window closed before the timer fires. The old code cleared the
// pending timer on cleanup, so this text was silently discarded.
test("edits survive closing the window inside the debounce window", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto("/");
  await page.waitForSelector(".island");
  await page.getByRole("button", { name: "Editor", exact: true }).click();

  const win = page.locator(".editor-window");
  await win.locator("nav[aria-label='Scripts'] .editor-window__new").click();
  await win.locator(".editor-window__main button").first().click();
  const scriptName = await win.locator(".editor-window__name").innerText();

  await win.locator(".cm-content").click();
  const marker = `// unmount-${Date.now()}`;
  await page.keyboard.type(marker);

  // Close immediately — no wait, so we are inside the 600ms debounce.
  await page.getByRole("button", { name: /Close Editor/i }).click();
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: "Editor", exact: true }).click();
  await win.locator(`nav[aria-label='Scripts'] ul button:has-text("${scriptName}")`).first().click();
  await expect(win.locator(".cm-content")).toContainText(marker, { timeout: 10_000 });
});
