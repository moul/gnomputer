#!/usr/bin/env node
// Records the README demo video from a running Gnomputer.
//
//   node scripts/capture-demo.mjs                       # deployed site
//   node scripts/capture-demo.mjs http://localhost:5173  # local dev
//
// Same contract as capture-screenshots.mjs: a REAL chain, nothing seeded or
// mocked. If a beat looks empty, the realm is empty.
//
// Two things make a Playwright recording watchable rather than merely
// accurate:
//
//   1. There is no mouse cursor in a recorded video. Playwright's mouse
//      dispatches real events but draws nothing, so a tour of a hover-driven
//      UI reads as menus opening by themselves. A synthetic cursor is drawn
//      from the same events the app sees.
//
//   2. Most of the wall-clock here is waiting on a live chain — nine seconds
//      of nothing, repeatedly. Rather than speed the whole thing up (which
//      makes the deliberate parts frantic), each beat marks the span worth
//      keeping and ffmpeg concatenates only those. Loading is free; the
//      parts a human should watch play at their real speed.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.argv[2] ?? "https://moul.github.io/gnomputer/").replace(/\/?$/, "/");
const OUT = new URL("../../../docs/demo.mp4", import.meta.url).pathname;

const HERO_REALM = "gno.land/r/gov/dao";
const SIZE = { width: 1280, height: 800 };

// Drawn from the same mousemove/mousedown the app receives, so it cannot
// drift out of sync with what the UI is reacting to.
const CURSOR = () => {
  function install() {
    if (!document.body) return void requestAnimationFrame(install);
    const dot = document.createElement("div");
    dot.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;
      width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;opacity:0;
      background:rgba(255,255,255,.92);box-shadow:0 0 0 2px rgba(0,0,0,.6),0 2px 10px rgba(0,0,0,.55)`;
    document.documentElement.append(dot);
    addEventListener(
      "mousemove",
      (e) => {
        dot.style.opacity = "1";
        dot.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      },
      true
    );
    addEventListener(
      "mousedown",
      (e) => {
        const r = document.createElement("div");
        r.style.cssText = `position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;
          width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;
          border:2px solid rgba(255,255,255,.85);
          transform:translate(${e.clientX}px,${e.clientY}px) scale(.4)`;
        document.documentElement.append(r);
        r.animate(
          [
            { transform: r.style.transform, opacity: 0.9 },
            { transform: r.style.transform.replace("scale(.4)", "scale(3)"), opacity: 0 },
          ],
          { duration: 450, easing: "ease-out" }
        ).onfinish = () => r.remove();
      },
      true
    );
  }
  install();
};

const videoDir = mkdtempSync(join(tmpdir(), "gnomputer-demo-"));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: SIZE,
  deviceScaleFactor: 1,
  recordVideo: { dir: videoDir, size: SIZE },
});
await context.addInitScript(CURSOR);
const page = await context.newPage();

// Recording starts with the page, so every mark is relative to this.
const t0 = Date.now();
const at = () => (Date.now() - t0) / 1000;

/** Spans of the recording worth keeping, in seconds. Everything outside
 * them is chain latency and gets dropped. */
const keep = [];
let open = null;
const roll = () => {
  if (open === null) open = at();
};
const cut = (label) => {
  if (open === null) return;
  keep.push([open, at()]);
  console.log(`  keep ${open.toFixed(1)}–${at().toFixed(1)}s  ${label}`);
  open = null;
};

async function pointAt(locator, steps = 24) {
  const box = await locator.boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  return true;
}

async function clickAt(locator) {
  if (!(await pointAt(locator))) return false;
  await page.waitForTimeout(240);
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
  return true;
}

function lensTab(name) {
  return page.locator(".lens-tab-bar__item").filter({ hasText: new RegExp(`^${name}$`) }).first();
}

/** The first non-test .gno file in the tree. Not hardcoded: the point of
 * the beat is highlighted Gno, and which file provides it is the realm's
 * business — r/gov/dao's tree opens on gnomod.toml, which is not Gno and
 * makes the shot say nothing. */
async function firstGnoFile() {
  const files = page.getByRole("button", { name: /\.gno$/ });
  // Waited for, not slept on: the tree arrives when the chain answers, and
  // a fixed sleep here is the difference between a reliable script and one
  // that fails on a slow day.
  await files.first().waitFor({ state: "visible", timeout: 45000 });
  for (let i = 0; i < (await files.count()); i++) {
    const name = await files.nth(i).textContent();
    if (name && !name.includes("_test")) return files.nth(i);
  }
  return null;
}

// ---------------------------------------------------------------- the tour

console.log(`Recording ${BASE} …`);

await page.goto(`${BASE}?pkg=${HERO_REALM}`, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(10000);
const dismiss = page.locator(".first-run-note__dismiss");
if (await dismiss.count()) await clickAt(dismiss);
await page.mouse.move(SIZE.width / 2, SIZE.height - 40, { steps: 10 });
await page.waitForTimeout(1200);

// A default-sized window leaves most of the desktop empty, which reads as
// an unfinished page rather than as room. Maximized for the single-window
// beats, restored when a second app arrives — which also shows the control
// doing its job.
const maximize = page.locator(".window__control--maximize").first();
roll(); // 1. a live realm, rendered
await clickAt(maximize);
await page.waitForTimeout(3000);
cut("landing on a live realm");

await clickAt(lensTab("Source")); // 2. the same realm's on-chain source
const gnoFile = await firstGnoFile();
if (!gnoFile) throw new Error("no .gno file in the source tree — check the lens");
roll();
await clickAt(gnoFile);
await page.waitForTimeout(3400);
await page.mouse.move(700, 460, { steps: 20 });
await page.waitForTimeout(2200);
cut("deployed Gno source, read from the chain");

await clickAt(lensTab("Render")); // 3. a second app beside it
await page.waitForTimeout(1200);
roll();
await clickAt(maximize); // restore
await page.waitForTimeout(900);
await pointAt(page.locator('.island button[aria-label="Chain"]'));
await page.waitForTimeout(1100);
cut("restoring, and opening the Chain group");
const eventExplorer = page.getByRole("button", { name: /Event Explorer/i }).first();
if (await eventExplorer.count()) await clickAt(eventExplorer);
await page.mouse.move(60, SIZE.height - 60, { steps: 16 });
await page.waitForTimeout(9000); // events backfill from the indexer
roll();
await page.waitForTimeout(3600);
cut("two apps side by side, both live");

roll(); // 4. the command palette
await page.keyboard.press("Meta+k");
await page.waitForTimeout(700);
await page.keyboard.type("block", { delay: 110 });
await page.waitForTimeout(2000);
cut("the command palette");
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
await context.close(); // finalises the .webm
await browser.close();

// ------------------------------------------------------------------ encode

const raw = await page.video().path();
if (keep.length === 0) throw new Error("no segments marked — nothing to encode");

const filter =
  keep.map(([a, b], i) => `[0:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[v${i}]`).join(";") +
  ";" +
  keep.map((_, i) => `[v${i}]`).join("") +
  `concat=n=${keep.length}:v=1:a=0,fps=30,scale=${SIZE.width}:-2[out]`;

execFileSync(
  "ffmpeg",
  ["-y", "-i", raw, "-filter_complex", filter, "-map", "[out]",
   "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
   "-movflags", "+faststart", OUT],
  { stdio: ["ignore", "ignore", "pipe"] }
);
rmSync(videoDir, { recursive: true, force: true });

const kept = keep.reduce((sum, [a, b]) => sum + (b - a), 0);
console.log(`\ndocs/demo.mp4  ${kept.toFixed(1)}s kept of ${at().toFixed(1)}s recorded`);
