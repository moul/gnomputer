#!/usr/bin/env node
// Regenerates the README screenshots from a running Gnomputer.
//
//   node scripts/capture-screenshots.mjs                       # deployed site
//   node scripts/capture-screenshots.mjs http://localhost:5173  # local dev
//
// Committed because screenshots rot: the UI moves, the images don't, and a
// stale screenshot is a false claim in the same way stale README prose is —
// harder to notice, because nobody re-reads an image.
//
// Everything is captured against a REAL chain. Nothing here seeds or mocks
// data; if the shot looks empty, the realm is empty.
import { chromium } from "@playwright/test";

// Not named URL: that would shadow the global URL constructor used below.
const BASE = (process.argv[2] ?? "https://moul.github.io/gnomputer/").replace(/\/?$/, "/");
const OUT = new URL("../../../docs/screenshots/", import.meta.url).pathname;

// r/gov/dao is the hero realm because it reliably has real content —
// proposals with authors and statuses. Prefer a realm that is doing
// something over one that is merely important.
const HERO_REALM = "gno.land/r/gov/dao";
const SOURCE_REALM = "gno.land/r/sys/users";

const browser = await chromium.launch();

async function newPage(theme) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // crisp on retina; GitHub scales it down anyway
  });
  const page = await context.newPage();
  if (theme) {
    // Stored as a raw theme id, not JSON — see use-theme-persistence.ts.
    await page.addInitScript(
      (t) =>
        localStorage.setItem(
          "gnomputer:mirror:theme",
          JSON.stringify({ value: t, at: Date.now() })
        ),
      theme
    );
  }
  return page;
}

async function dismissFirstRun(page) {
  const dismiss = page.locator(".first-run-note__dismiss");
  if (await dismiss.count()) {
    await dismiss.click();
    await page.waitForTimeout(300);
  }
}

/** Crops to the island plus every open window, so there is no dead desktop. */
async function capture(page, name) {
  const clip = await page.evaluate(() => {
    const els = [document.querySelector(".island"), ...document.querySelectorAll(".window")].filter(
      Boolean
    );
    const rects = els.map((el) => el.getBoundingClientRect());
    const pad = 24;
    const x = Math.max(0, Math.min(...rects.map((r) => r.left)) - pad);
    const y = Math.max(0, Math.min(...rects.map((r) => r.top)) - pad);
    return {
      x,
      y,
      width: Math.min(window.innerWidth, Math.max(...rects.map((r) => r.right)) + pad) - x,
      height: Math.min(window.innerHeight, Math.max(...rects.map((r) => r.bottom)) + pad) - y,
    };
  });
  await page.screenshot({ path: `${OUT}${name}.png`, clip });
  console.log(`${name}.png  ${Math.round(clip.width)}x${Math.round(clip.height)}`);
}

// Generous waits throughout: these run against a real chain, and a
// half-loaded screenshot is worse than a slow script.
async function hero() {
  const page = await newPage();
  await page.goto(`${BASE}?pkg=${HERO_REALM}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(9000);
  await dismissFirstRun(page);
  await page.locator('.island button[aria-label="Chain"]').hover();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Event Explorer/i }).first().click().catch(() => {});
  await page.mouse.move(20, 880); // off the island, so the popover closes
  await page.waitForTimeout(9000);
  await capture(page, "desktop");
  await page.context().close();
}

async function source() {
  const page = await newPage();
  await page.goto(`${BASE}?pkg=${SOURCE_REALM}&lens=source`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(9000);
  await dismissFirstRun(page);
  // A .gno file, not the README — the point of this shot is highlighting.
  await page.getByRole("button", { name: "users.gno", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(4000);
  await capture(page, "source");
  await page.context().close();
}

async function cypherpunk() {
  const page = await newPage("ascii-cypherpunk");
  await page.goto(`${BASE}?pkg=${HERO_REALM}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(9000);
  await dismissFirstRun(page);
  const applied = await page.locator("html").getAttribute("data-theme");
  if (applied !== "ascii-cypherpunk") {
    throw new Error(`theme did not apply: got ${applied}. Check the storage key.`);
  }
  await capture(page, "cypherpunk");
  await page.context().close();
}

await hero();
await source();
await cypherpunk();
await browser.close();
console.log(`\nWritten to docs/screenshots/ from ${BASE}`);
