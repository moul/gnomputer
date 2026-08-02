import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { openDatabase } from "@gnomputer/storage";
import { createTrailApi } from "./trail-api";

/** A database nothing else in this file touches. The suite's older tests
 * share a handful of fixed names cleared in beforeEach; these newer ones
 * each take their own so a failure cannot leak into the next. */
function freshDb(suffix: string) {
  const name = `gnomputer-trails-${suffix}`;
  indexedDB.deleteDatabase(name);
  return openDatabase(name);
}

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

describe("listTrails step counts", () => {
  it("counts steps per trail correctly across several trails", async () => {
    const db = openDatabase("trails-count-test");
    await db.delete();
    await db.open();
    const api = createTrailApi(db);

    const a = await api.start("A");
    await api.addStep(a, { refUri: "gno://t/realm/x", label: "x" });
    await api.addStep(a, { refUri: "gno://t/realm/y", label: "y" });
    await api.addStep(a, { refUri: "gno://t/realm/z", label: "z" });

    const b = await api.start("B");
    await api.addStep(b, { refUri: "gno://t/realm/x", label: "x" });

    await api.start("C"); // no steps at all

    const byName = Object.fromEntries(
      (await api.listTrails()).map((t) => [t.name, t.stepCount])
    );
    expect(byName).toEqual({ A: 3, B: 1, C: 0 });
    db.close();
  });

  it("does not issue one query per trail", async () => {
    // The old implementation ran a count() per trail. "Clear history"
    // starts a fresh Trail rather than deleting the old one, so trails
    // accumulate for the life of the profile — the N+1 got slower every
    // time someone cleared their history (AUD-045).
    const db = openDatabase("trails-nplus1-test");
    await db.delete();
    await db.open();
    const api = createTrailApi(db);

    for (let i = 0; i < 25; i++) {
      const id = await api.start(`trail ${i}`);
      await api.addStep(id, { refUri: `gno://t/realm/${i}`, label: `${i}` });
    }

    const countSpy = vi.spyOn(db.trailSteps, "where");
    const trails = await api.listTrails();
    expect(trails).toHaveLength(25);
    expect(trails.every((t) => t.stepCount === 1)).toBe(true);
    // The old code called where("trailId") once per trail.
    expect(countSpy).not.toHaveBeenCalled();
    countSpy.mockRestore();
    db.close();
  });
});

describe("deleting a Trail", () => {
  it("removes the Trail and every step on it", async () => {
    const db = freshDb("trail-delete");
    const api = createTrailApi(db);
    const a = await api.start("A");
    await api.addStep(a, "gno://t/realm/x", "x");
    await api.addStep(a, "gno://t/realm/y", "y");

    await api.deleteTrail(a);

    expect(await db.trails.get(a)).toBeUndefined();
    // Orphaned steps would be invisible and permanent — the whole point of
    // deleting a Trail is that what it recorded is gone.
    expect(await db.trailSteps.where("trailId").equals(a).count()).toBe(0);
  });

  it("promotes the next most recent Trail when the active one is deleted", async () => {
    const db = freshDb("trail-delete-active");
    const api = createTrailApi(db);
    const older = await api.start("Older");
    await api.addStep(older, "gno://t/realm/x", "x");
    const active = await api.start("Active");

    const nowActive = await api.deleteTrail(active);

    expect(nowActive).toBe(older);
    expect(await api.getActiveTrailId()).toBe(older);
  });

  it("starts a fresh Trail when the last one is deleted", async () => {
    // A null active Trail would make the next page visit silently start an
    // unnamed one, which looks like the delete failed.
    const db = freshDb("trail-delete-last");
    const api = createTrailApi(db);
    const only = await api.start("Only");

    const nowActive = await api.deleteTrail(only);

    expect(nowActive).not.toBe(only);
    expect(await api.getActiveTrailId()).toBe(nowActive);
    expect(await db.trails.get(nowActive)).toBeDefined();
  });

  it("leaves the active Trail alone when a different one is deleted", async () => {
    const db = freshDb("trail-delete-other");
    const api = createTrailApi(db);
    const other = await api.start("Other");
    const active = await api.start("Active");

    expect(await api.deleteTrail(other)).toBe(active);
    expect(await api.getActiveTrailId()).toBe(active);
  });

  it("keeps other Trails' steps", async () => {
    const db = freshDb("trail-delete-isolation");
    const api = createTrailApi(db);
    const keep = await api.start("Keep");
    await api.addStep(keep, "gno://t/realm/keep", "keep");
    const drop = await api.start("Drop");
    await api.addStep(drop, "gno://t/realm/drop", "drop");

    await api.deleteTrail(drop);

    expect((await api.getSteps(keep)).map((s) => s.label)).toEqual(["keep"]);
  });
});

describe("exporting a Trail", () => {
  it("returns the Trail with its steps in order", async () => {
    const db = freshDb("trail-export");
    const api = createTrailApi(db);
    const id = await api.start("My Trail");
    await api.addStep(id, "gno://t/realm/first", "first");
    await api.addStep(id, "gno://t/realm/second", "second");

    const exported = await api.exportTrail(id);

    expect(exported?.name).toBe("My Trail");
    expect(exported?.steps.map((s) => s.label)).toEqual(["first", "second"]);
    expect(exported?.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("is null for a Trail that no longer exists", async () => {
    const db = freshDb("trail-export-missing");
    const api = createTrailApi(db);
    expect(await api.exportTrail("trail-nope")).toBeNull();
  });
});
