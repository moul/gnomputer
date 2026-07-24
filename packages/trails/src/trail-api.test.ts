import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "@gnomputer/storage";
import { createTrailApi } from "./trail-api";

describe("TrailAPI", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase("gnomputer-trails-test");
    indexedDB.deleteDatabase("gnomputer-trails-test-2");
    indexedDB.deleteDatabase("gnomputer-trails-test-3");
    indexedDB.deleteDatabase("gnomputer-trails-test-4");
    indexedDB.deleteDatabase("gnomputer-trails-test-5");
    indexedDB.deleteDatabase("gnomputer-trails-test-6");
    indexedDB.deleteDatabase("gnomputer-trails-test-7");
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

  it("restores the active Trail id from a fresh TrailAPI instance (simulated reload)", async () => {
    const db = openDatabase("gnomputer-trails-test-4");
    const firstSession = createTrailApi(db);
    const trailId = await firstSession.start("Untitled Trail");

    const reloadedSession = createTrailApi(db);
    expect(await reloadedSession.getActiveTrailId()).toBe(trailId);
  });

  it("does not split concurrent first-visits across two different Trails", async () => {
    // Simulates two sibling components (e.g. RealmBrowser + SourceExplorer) both
    // mounting at once and both trying to record the first step of a session.
    const db = openDatabase("gnomputer-trails-test-5");
    const api = createTrailApi(db);

    const [trailIdA, trailIdB] = await Promise.all([
      api.ensureActiveTrailId("Untitled Trail"),
      api.ensureActiveTrailId("Untitled Trail"),
    ]);
    expect(trailIdA).toBe(trailIdB);

    await Promise.all([
      api.addStep(trailIdA, "gno://test13/realm/gno.land/r/demo/foo", "Foo"),
      api.addStep(trailIdA, "gno://test13/source-file/gno.land/r/demo/foo", "Foo source"),
    ]);

    const steps = await api.getSteps(trailIdA);
    expect(steps.map((s) => s.label).sort()).toEqual(["Foo", "Foo source"]);
  });

  it("lists all Trails with step counts, most recently updated first", async () => {
    const db = openDatabase("gnomputer-trails-test-6");
    const api = createTrailApi(db);
    const trailA = await api.start("Trail A");
    await api.addStep(trailA, "gno://test13/realm/gno.land/r/demo/foo", "Foo");
    const trailB = await api.start("Trail B");
    await api.addStep(trailB, "gno://test13/realm/gno.land/r/demo/bar", "Bar");
    await api.addStep(trailB, "gno://test13/realm/gno.land/r/demo/baz", "Baz");

    const trails = await api.listTrails();
    expect(trails.map((t) => ({ name: t.name, stepCount: t.stepCount }))).toEqual([
      { name: "Trail B", stepCount: 2 },
      { name: "Trail A", stepCount: 1 },
    ]);
  });

  it("switches the active Trail without creating a new one", async () => {
    const db = openDatabase("gnomputer-trails-test-7");
    const api = createTrailApi(db);
    const trailA = await api.start("Trail A");
    const trailB = await api.start("Trail B");
    expect(await api.getActiveTrailId()).toBe(trailB);

    await api.setActiveTrail(trailA);
    expect(await api.getActiveTrailId()).toBe(trailA);

    const trails = await api.listTrails();
    expect(trails).toHaveLength(2);
  });
});
