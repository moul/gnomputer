import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import { openDatabase } from "./db";

describe("GnomputerDB", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("gnomputer-test");
  });

  it("persists Trail steps in order and restores them", async () => {
    const db = openDatabase("gnomputer-test");
    await db.trails.put({
      id: "t1",
      name: "Untitled Trail",
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z",
    });
    await db.trailSteps.bulkPut([
      {
        trailId: "t1",
        order: 0,
        refUri: "gno://test13/realm/gno.land/r/demo/foo",
        label: "Foo",
        createdAt: "2026-07-22T00:00:00.000Z",
      },
      {
        trailId: "t1",
        order: 1,
        refUri: "gno://test13/source-file/gno.land/r/demo/foo",
        label: "Foo source",
        createdAt: "2026-07-22T00:00:00.000Z",
      },
    ]);
    const steps = await db.trailSteps.where("trailId").equals("t1").sortBy("order");
    expect(steps.map((s) => s.label)).toEqual(["Foo", "Foo source"]);
  });
});

describe("trailSteps primary key", () => {
  it("is keyed by [trailId+order], so the same refUri can appear in two trails", async () => {
    // The table was typed EntityTable<TrailStepRecord, "refUri"> — declaring
    // a primary key that isn't the real one. It never broke a call site,
    // because nothing does get() on this table, but it made add() treat
    // refUri as optional and would have let get(refUri) type-check while
    // matching nothing.
    const db = openDatabase("gnomputer-test-trailsteps-pk");
    await db.delete();
    await db.open();

    const step = { refUri: "gno://topaz/realm/gno.land/r/demo/x", label: "x", createdAt: "t" };
    await db.trailSteps.put({ ...step, trailId: "a", order: 0 });
    await db.trailSteps.put({ ...step, trailId: "b", order: 0 });
    expect(await db.trailSteps.count()).toBe(2);

    // Same trail and order overwrites — that is the actual primary key.
    await db.trailSteps.put({ ...step, trailId: "a", order: 0, label: "renamed" });
    expect(await db.trailSteps.count()).toBe(2);
    const [inA] = await db.trailSteps.where("trailId").equals("a").toArray();
    expect(inA?.label).toBe("renamed");

    db.close();
  });
});

describe("v4 drops the workspaces store", () => {
  it("removes a table that a v3 database still has, keeping user content", async () => {
    // Dexie only deletes a store if a later version names it `null`;
    // leaving it out silently keeps it. This opens a real v3 database with
    // the old schema, writes to every store, then reopens at the current
    // version and checks that workspaces is gone and nothing else is.
    const name = "gnomputer-test-v4-migration";
    indexedDB.deleteDatabase(name);

    const v3 = new Dexie(name);
    v3.version(3).stores({
      workspaces: "id, networkId",
      trails: "id",
      trailSteps: "[trailId+order], trailId",
      favorites: "refUri",
      meta: "key",
      queryCache: "key, insertSeq",
      scripts: "id, updatedSeq",
    });
    await v3.open();
    await v3.table("workspaces").put({ id: "explore", name: "Explore", networkId: "test13" });
    await v3.table("favorites").put({ refUri: "gno://topaz/realm/r/x", label: "X", createdAt: "1" });
    await v3.table("trails").put({ id: "t1", name: "T", createdAt: "1", updatedAt: "1" });
    expect(v3.tables.map((t) => t.name)).toContain("workspaces");
    v3.close();

    const db = openDatabase(name);
    await db.open();
    expect(db.tables.map((t) => t.name)).not.toContain("workspaces");
    // The migration is a deletion of one table, not a reset: everything the
    // user actually authored has to survive it.
    expect(await db.favorites.get("gno://topaz/realm/r/x")).toMatchObject({ label: "X" });
    expect(await db.trails.get("t1")).toMatchObject({ name: "T" });
    db.close();
  });
});
