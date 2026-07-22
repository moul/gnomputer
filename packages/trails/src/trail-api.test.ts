import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "@gnomputer/storage";
import { createTrailApi } from "./trail-api";

describe("TrailAPI", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase("gnomputer-trails-test");
    indexedDB.deleteDatabase("gnomputer-trails-test-2");
    indexedDB.deleteDatabase("gnomputer-trails-test-3");
  });

  it("starts a Trail and records steps in order", async () => {
    const db = openDatabase("gnomputer-trails-test");
    const api = createTrailApi(db);
    const trailId = await api.start("Untitled Trail");
    await api.addStep(trailId, "gno://test13/realm/gno.land/r/demo/foo", "Foo");
    await api.addStep(trailId, "gno://test13/source-file/gno.land/r/demo/foo", "Foo source");

    const steps = await api.getSteps(trailId);
    expect(steps.map((s) => s.label)).toEqual(["Foo", "Foo source"]);
  });

  it("renames a Trail", async () => {
    const db = openDatabase("gnomputer-trails-test-2");
    const api = createTrailApi(db);
    const trailId = await api.start("Untitled Trail");
    await api.rename(trailId, "Investigate proposal 12");
    const trail = await db.trails.get(trailId);
    expect(trail?.name).toBe("Investigate proposal 12");
  });

  it("tracks the active Trail id across calls", async () => {
    const db = openDatabase("gnomputer-trails-test-3");
    const api = createTrailApi(db);
    const trailId = await api.start("Untitled Trail");
    expect(await api.getActiveTrailId()).toBe(trailId);
  });
});
