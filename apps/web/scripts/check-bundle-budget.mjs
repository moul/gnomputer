#!/usr/bin/env node
// Enforces a size budget on what a FIRST visit downloads (AUD-036).
//
// A ratchet, not a target: the numbers below sit just above what main
// currently ships. Lower them when the bundle shrinks; do not raise them to
// make a branch pass. Raising one is a decision about what mobile users pay
// on their first load, and should be argued for in the PR that does it.
//
// Only the app shell counts. Everything else is lazy-loaded per app and is
// listed in the report for visibility, not gated — code-editor is 148KB
// gzipped and nobody who never opens the Editor pays for it.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;

/** Gzipped kilobytes. Gzip because that is what actually crosses the
 * network; raw bytes would flatter minified JavaScript. */
const BUDGETS_KB = {
  total: 410,
  "index.html": 3,
  "index-*.js": 130,
  "vendor-*.js": 92,
  "chain-client-*.js": 185,
  "*.css": 14,
};

// These are what the service worker precaches, i.e. exactly what a first
// visit pulls before anything is interactive. Keep in step with
// workbox.globPatterns in vite.config.ts.
const SHELL_PATTERNS = ["index.html", "index-*.js", "vendor-*.js", "chain-client-*.js", "*.css"];

function toRegExp(pattern) {
  return new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
}

function collect() {
  const files = [];
  for (const dir of ["", "assets"]) {
    const full = join(DIST, dir);
    let entries;
    try {
      entries = readdirSync(full);
    } catch {
      continue;
    }
    for (const name of entries) {
      const path = join(full, name);
      if (!statSync(path).isFile()) continue;
      files.push({ name, path, gzipKb: gzipSync(readFileSync(path)).length / 1024 });
    }
  }
  return files;
}

const files = collect();
if (files.length === 0) {
  console.error("No build output found. Run the build first.");
  process.exit(1);
}

const shell = files.filter((f) => SHELL_PATTERNS.some((p) => toRegExp(p).test(f.name)));
const lazy = files
  .filter((f) => !shell.includes(f) && f.name.endsWith(".js"))
  .sort((a, b) => b.gzipKb - a.gzipKb);

const failures = [];
const rows = [];

for (const pattern of SHELL_PATTERNS) {
  const matched = shell.filter((f) => toRegExp(pattern).test(f.name));
  const kb = matched.reduce((sum, f) => sum + f.gzipKb, 0);
  const budget = BUDGETS_KB[pattern];
  rows.push([pattern, kb, budget]);
  if (budget !== undefined && kb > budget) {
    failures.push(`${pattern} is ${kb.toFixed(1)}KB gzipped, over its ${budget}KB budget`);
  }
}

const total = shell.reduce((sum, f) => sum + f.gzipKb, 0);
rows.push(["TOTAL (first visit)", total, BUDGETS_KB.total]);
if (total > BUDGETS_KB.total) {
  failures.push(
    `the first-visit payload is ${total.toFixed(1)}KB gzipped, over its ${BUDGETS_KB.total}KB budget`
  );
}

console.log("First-visit payload (gzipped):");
for (const [name, kb, budget] of rows) {
  const headroom = budget === undefined ? "" : ` / ${budget}KB`;
  console.log(`  ${name.padEnd(24)} ${kb.toFixed(1).padStart(7)}KB${headroom}`);
}
console.log("\nLazy chunks, not gated (largest first):");
for (const f of lazy.slice(0, 5)) {
  console.log(`  ${f.name.padEnd(40)} ${f.gzipKb.toFixed(1).padStart(7)}KB`);
}

if (failures.length > 0) {
  console.error("\nBundle budget exceeded:");
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    "\nIf the growth is justified, raise the budget in this file in the same PR and say why."
  );
  process.exit(1);
}
console.log("\nWithin budget.");
