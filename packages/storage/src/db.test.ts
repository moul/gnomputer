import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "./db";

describe("GnomputerDB", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("gnomputer-test");
  });

  it("persists and restores a workspace", async () => {
    const db = openDatabase("gnomputer-test");
    await db.workspaces.put({
      id: "explore",
      name: "Explore",
      networkId: "test13",
      openRefs: [],
      updatedAt: "2026-07-22T00:00:00.000Z",
    });
    const found = await db.workspaces.get("explore");
    expect(found?.name).toBe("Explore");
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
