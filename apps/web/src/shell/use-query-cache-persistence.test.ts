import { describe, it, expect } from "vitest";
import {
  CACHE_SCHEMA_VERSION,
  persistedKey,
  restorableKey,
} from "./use-query-cache-persistence";

describe("persisted query cache keys", () => {
  it("round-trips a query key through storage", () => {
    const key = ["realm-history", "sapphire", "gno.land/r/demo/a"];
    expect(restorableKey(persistedKey(key))).toEqual(key);
  });

  it("refuses an entry written by an older schema version", () => {
    // The bug this exists for: #211 changed realmHistory's result from
    // `IndexerEvent[]` to `{ events, callCount }`. The cache stores the inner
    // value verbatim under an unversioned key, so every returning user who had
    // opened a realm's History tab got the OLD array handed to code that read
    // `.events.length` — `undefined.length`, and a crashed Browser window.
    // Refusing the entry costs one cold load; restoring it crashes the app.
    const writtenBefore = JSON.stringify([
      CACHE_SCHEMA_VERSION - 1,
      "realm-history",
      "sapphire",
      "gno.land/r/demo/a",
    ]);
    expect(restorableKey(writtenBefore)).toBeNull();
  });

  it("refuses an entry from before keys were versioned at all", () => {
    // What is actually in real users' browsers today: a bare query key, whose
    // first element is a string rather than a version number.
    const legacy = JSON.stringify(["realm-history", "sapphire", "gno.land/r/demo/a"]);
    expect(restorableKey(legacy)).toBeNull();
  });

  it("refuses anything that is not a non-empty array", () => {
    expect(restorableKey(JSON.stringify({ queryKey: "realm-history" }))).toBeNull();
    expect(restorableKey(JSON.stringify([]))).toBeNull();
    expect(restorableKey(JSON.stringify("realm-history"))).toBeNull();
    expect(restorableKey(JSON.stringify(null))).toBeNull();
  });

  it("keeps a key that is itself empty after the version", () => {
    // Not a real query key, but the slice must not be confused with "refused".
    expect(restorableKey(JSON.stringify([CACHE_SCHEMA_VERSION]))).toEqual([]);
  });

  it("preserves non-string parts of a key, which React Query allows", () => {
    const key = ["block", "sapphire", 556_537, { includeTxs: true }];
    expect(restorableKey(persistedKey(key))).toEqual(key);
  });
});
