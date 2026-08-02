import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { openDatabase } from "@gnomputer/storage";
import { createGnomputerSDK } from "./create-sdk";

describe("createGnomputerSDK", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase("gnomputer-sdk-test");
  });

  it("defaults to the topaz network", () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    expect(sdk.networks.getActive().id).toBe("topaz");
  });

  it("switches active network", () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    sdk.networks.setActive("betanet");
    expect(sdk.networks.getActive().id).toBe("betanet");
  });

  it("switches to a full network config directly, for a custom network not in list()", () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    const custom = {
      id: "my-custom",
      name: "My Custom Node",
      chainId: "unknown",
      rpcUrl: "http://localhost:12345",
      environment: "custom" as const,
      persistence: "unknown" as const,
      trust: "custom" as const,
      capabilities: [],
    };
    sdk.networks.setActiveConfig(custom);
    expect(sdk.networks.getActive()).toEqual(custom);
  });

  it("starts a Trail and records a step through the SDK", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    const trailId = await sdk.trails.start("Untitled Trail");
    await sdk.trails.addStep(trailId, "gno://test13/realm/gno.land/r/demo/foo", "Foo");
    const steps = await sdk.trails.getSteps(trailId);
    expect(steps).toHaveLength(1);
  });

  const FOO = "gno://test13/realm/gno.land/r/demo/foo";

  it("sets and clears a favorite", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    await sdk.favorites.set(FOO, "Foo", true);
    expect(await sdk.favorites.list()).toHaveLength(1);
    await sdk.favorites.set(FOO, "Foo", false);
    expect(await sdk.favorites.list()).toHaveLength(0);
  });

  it("is idempotent, so a repeated star does not duplicate or reshuffle", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    await sdk.favorites.set(FOO, "Foo", true);
    const first = (await sdk.favorites.list())[0]!.createdAt;
    await sdk.favorites.set(FOO, "Foo", true);
    const rows = await sdk.favorites.list();
    expect(rows).toHaveLength(1);
    // A no-op write must not move it to the top of a newest-first list.
    expect(rows[0]!.createdAt).toBe(first);
  });

  it("clearing something already absent is not an error", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    await expect(sdk.favorites.set(FOO, "Foo", false)).resolves.toBeUndefined();
  });

  it("lands on the last requested state when writes overlap", async () => {
    // The bug this replaced: `toggle` read the current state from the
    // database before deciding. Two toggles in one tick — an impatient
    // double-click — both read "not favorited", both wrote, and the UI and
    // the database disagreed permanently. The star read unstarred, the row
    // was there, and a reload brought it back.
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });

    await Promise.all([
      sdk.favorites.set(FOO, "Foo", true),
      sdk.favorites.set(FOO, "Foo", false),
    ]);

    expect(await sdk.favorites.list()).toHaveLength(0);

    await Promise.all([
      sdk.favorites.set(FOO, "Foo", false),
      sdk.favorites.set(FOO, "Foo", true),
    ]);

    expect(await sdk.favorites.list()).toHaveLength(1);
  });

  it("persists and restores arbitrary UI state by key", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    expect(await sdk.uiState.get("window-layout:home")).toBeNull();
    await sdk.uiState.set("window-layout:home", '{"realm":{"x":10}}');
    expect(await sdk.uiState.get("window-layout:home")).toBe('{"realm":{"x":10}}');
  });

  it("does not let uiState collide with the internal Trail active-id key", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    await sdk.uiState.set("activeTrailId", "not-a-real-trail-id");
    const trailId = await sdk.trails.start("Untitled Trail");
    expect(await sdk.trails.getActiveTrailId()).toBe(trailId);
  });

  it("persists and restores query cache entries in insertion order", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    await sdk.queryCache.set('["a"]', { value: 1 }, 100);
    await sdk.queryCache.set('["b"]', { value: 2 }, 200);
    const all = await sdk.queryCache.getAll();
    expect(all).toEqual([
      { queryKeyJson: '["a"]', data: { value: 1 }, updatedAt: 100 },
      { queryKeyJson: '["b"]', data: { value: 2 }, updatedAt: 200 },
    ]);
  });

  it("updates a query cache entry in place without moving it in FIFO order", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    await sdk.queryCache.set('["a"]', { value: 1 }, 100);
    await sdk.queryCache.set('["b"]', { value: 2 }, 200);
    await sdk.queryCache.set('["a"]', { value: 3 }, 300);
    const all = await sdk.queryCache.getAll();
    expect(all.map((e) => e.queryKeyJson)).toEqual(['["a"]', '["b"]']);
    expect(all[0].data).toEqual({ value: 3 });
    expect(all[0].updatedAt).toBe(300);
  });

  it("evicts the oldest query cache entry once past the FIFO cap", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    for (let i = 0; i < 51; i++) {
      await sdk.queryCache.set(`["key-${i}"]`, { i }, i);
    }
    const all = await sdk.queryCache.getAll();
    expect(all).toHaveLength(50);
    expect(all[0].queryKeyJson).toBe('["key-1"]');
    expect(all.at(-1)!.queryKeyJson).toBe('["key-50"]');
  });

  it("creates, lists (most recently updated first), updates, and removes a script", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    const a = await sdk.scripts.create("First", "package main");
    const b = await sdk.scripts.create("Second", "package main");
    expect((await sdk.scripts.list()).map((s) => s.id)).toEqual([b.id, a.id]);

    await sdk.scripts.update(a.id, { code: "package main // edited" });
    const list = await sdk.scripts.list();
    expect(list.map((s) => s.id)).toEqual([a.id, b.id]);
    expect(list[0].code).toBe("package main // edited");

    await sdk.scripts.remove(b.id);
    expect((await sdk.scripts.list()).map((s) => s.id)).toEqual([a.id]);
  });
});

describe("query cache corruption", () => {
  it("skips one unparseable row instead of failing the whole read", async () => {
    // getAll used to JSON.parse inside a map(), so a single bad row rejected
    // the entire call. The caller sets its "hydrated" flag at the end of the
    // same block, so that failure also stopped the cache SAVING anything for
    // the rest of the session — one bad row disabled the feature until
    // storage was cleared (AUD-006).
    const sdk = createGnomputerSDK({ dbName: "cache-corruption-test" });
    await sdk.queryCache.set('["a"]', { ok: 1 }, 1);
    await sdk.queryCache.set('["b"]', { ok: 2 }, 2);

    const db = openDatabase("cache-corruption-test");
    const row = await db.queryCache.get('["a"]');
    await db.queryCache.put({ ...row!, dataJson: "{not json" });

    const entries = await sdk.queryCache.getAll();
    expect(entries.map((e) => e.queryKeyJson)).toEqual(['["b"]']);
  });

  it("deletes the bad row so it does not cost anything on the next boot", async () => {
    const sdk = createGnomputerSDK({ dbName: "cache-corruption-delete-test" });
    await sdk.queryCache.set('["a"]', { ok: 1 }, 1);

    const db = openDatabase("cache-corruption-delete-test");
    await db.queryCache.put({ ...(await db.queryCache.get('["a"]'))!, dataJson: "{nope" });

    await sdk.queryCache.getAll();
    await vi.waitFor(async () => expect(await db.queryCache.count()).toBe(0));
  });

  it("drops rows written under a different cache format", async () => {
    const sdk = createGnomputerSDK({ dbName: "cache-version-test" });
    await sdk.queryCache.set('["a"]', { ok: 1 }, 1);

    const db = openDatabase("cache-version-test");
    await db.queryCache.put({ ...(await db.queryCache.get('["a"]'))!, schemaVersion: 999 });

    expect(await sdk.queryCache.getAll()).toEqual([]);
  });
});
