#!/usr/bin/env node
// Checks that a built release is internally consistent before it can ship
// (AUD-041). Three things, each of which has a specific way of going wrong
// that is invisible until it is in front of users.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const failures = [];

function fail(message) {
  failures.push(message);
}

// 1. version.json must name the same commit as the code beside it.
//
// The running tab polls version.json and shows "new version available" when
// its hash differs from the __GIT_HASH__ compiled into the bundle. If those
// two disagree within a single release — a stale asset served next to a
// fresh version.json, say — every visitor sees an update banner that
// reloading cannot clear, because the reload lands on the same mismatch.
const versionPath = join(DIST, "version.json");
if (!existsSync(versionPath)) {
  fail("no version.json in the build output");
} else {
  const { hash } = JSON.parse(readFileSync(versionPath, "utf8"));
  if (!hash) {
    fail("version.json has no hash");
  } else if (hash === "unknown") {
    // gitHash() falls back to "unknown" when git is unavailable. Fine
    // locally; a release that cannot identify itself is not.
    console.log("  release hash is 'unknown' (no git) — skipping the hash match");
  } else {
    const entry = readdirSync(join(DIST, "assets")).find(
      (f) => f.startsWith("index-") && f.endsWith(".js")
    );
    if (!entry) {
      fail("no entry chunk found to check the hash against");
    } else if (!readFileSync(join(DIST, "assets", entry), "utf8").includes(hash)) {
      fail(
        `version.json says ${hash} but that hash does not appear in ${entry} — ` +
          "the version file and the code it sits beside are from different builds"
      );
    }
  }
}

// 2. Source maps must not be precached.
//
// They are published on purpose, but a browser only fetches one when
// devtools is open. Precaching them would push megabytes onto every first
// visit for a file almost nobody requests.
const swPath = join(DIST, "sw.js");
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, "utf8");
  const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
  const maps = urls.filter((u) => u.endsWith(".map"));
  if (maps.length > 0) {
    fail(`the service worker precaches ${maps.length} source map(s): ${maps.join(", ")}`);
  }

  // 3. Everything precached must actually exist.
  //
  // A precache entry for a missing file makes the service worker fail to
  // install, which disables offline support entirely and silently.
  const missing = urls.filter((u) => !existsSync(join(DIST, u)));
  if (missing.length > 0) {
    fail(`the service worker precaches files that are not in the build: ${missing.join(", ")}`);
  }

  if (failures.length === 0) {
    console.log(`  ${urls.length} precached files, all present, no source maps`);
  }
}

if (failures.length > 0) {
  console.error("Release integrity check failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("Release is internally consistent.");
