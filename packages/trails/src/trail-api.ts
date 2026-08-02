import type { GnomputerDB, TrailStepRecord } from "@gnomputer/storage";

export interface TrailSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  stepCount: number;
}

export interface TrailAPI {
  start(name: string): Promise<string>;
  addStep(trailId: string, refUri: string, label: string): Promise<void>;
  rename(trailId: string, name: string): Promise<void>;
  getSteps(trailId: string): Promise<TrailStepRecord[]>;
  getActiveTrailId(): Promise<string | null>;
  ensureActiveTrailId(defaultName: string): Promise<string>;
  /** Every Trail ever started, most recently updated first — "Clear
   * history" has always started a fresh Trail without deleting the old
   * one (db.trails rows accumulate), this just makes those past Trails
   * reachable instead of silently orphaned. */
  listTrails(): Promise<TrailSummary[]>;
  /** Switches the active Trail to an existing one (e.g. from listTrails),
   * without creating a new Trail the way start() does. */
  setActiveTrail(trailId: string): Promise<void>;
  /** Removes a Trail and every step on it, and returns the id that is
   * active afterwards.
   *
   * Until this existed a Trail could be started and renamed but never
   * removed: "Clear history" starts a fresh one and leaves the old rows
   * behind, so the list only ever grew, and a Trail recording where you
   * have been was permanent for the life of the browser profile. For data
   * described as user-owned that is the wrong default (AUD-045).
   *
   * Deleting the active Trail promotes the next most recently updated one
   * rather than leaving nothing active — a null active Trail would make
   * the next page visit silently start an unnamed one. */
  deleteTrail(trailId: string): Promise<string>;
  /** A Trail and its steps as plain data, for export. Null if it is gone. */
  exportTrail(trailId: string): Promise<TrailExport | null>;
}

export interface TrailExport {
  name: string;
  createdAt: string;
  updatedAt: string;
  exportedAt: string;
  steps: { refUri: string; label: string; createdAt: string }[];
}

const ACTIVE_TRAIL_META_KEY = "activeTrailId";

function newId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `trail-${random}`;
}

export function createTrailApi(db: GnomputerDB): TrailAPI {
  // IndexedDB writes here are read-modify-write (read a count, then put at that
  // position) — concurrent callers (e.g. two sibling components both recording a
  // step on mount) would otherwise race and silently clobber each other's step or
  // create two different "active" trails. Serializing through this queue makes
  // every start()/addStep()/ensureActiveTrailId() call observe the others' effects.
  let writeQueue: Promise<unknown> = Promise.resolve();
  function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const result = writeQueue.then(fn, fn);
    writeQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  async function setActiveTrailId(id: string): Promise<void> {
    await db.meta.put({ key: ACTIVE_TRAIL_META_KEY, value: id });
  }

  async function startUnsafe(name: string): Promise<string> {
    const id = newId();
    const now = new Date().toISOString();
    await db.trails.put({ id, name, createdAt: now, updatedAt: now });
    await setActiveTrailId(id);
    return id;
  }

  return {
    start(name) {
      return serialize(() => startUnsafe(name));
    },

    ensureActiveTrailId(defaultName) {
      return serialize(async () => {
        const meta = await db.meta.get(ACTIVE_TRAIL_META_KEY);
        if (meta?.value) return meta.value;
        return startUnsafe(defaultName);
      });
    },

    addStep(trailId, refUri, label) {
      return serialize(async () => {
        const existing = await db.trailSteps.where("trailId").equals(trailId).count();
        await db.trailSteps.put({
          trailId,
          order: existing,
          refUri,
          label,
          createdAt: new Date().toISOString(),
        });
        await db.trails.update(trailId, { updatedAt: new Date().toISOString() });
      });
    },

    async rename(trailId, name) {
      await db.trails.update(trailId, { name, updatedAt: new Date().toISOString() });
    },

    async getSteps(trailId) {
      return db.trailSteps.where("trailId").equals(trailId).sortBy("order");
    },

    async getActiveTrailId() {
      const meta = await db.meta.get(ACTIVE_TRAIL_META_KEY);
      return meta?.value ?? null;
    },

    async listTrails() {
      const trails = await db.trails.toArray();

      // One pass over the trailId index instead of a count() per trail.
      // "Clear history" starts a fresh Trail rather than deleting the old
      // one, so trails accumulate for the lifetime of the browser profile —
      // the N+1 got slower every time someone cleared their history, which
      // is exactly backwards (AUD-045).
      //
      // eachKey walks the index without loading a single step record, so
      // this stays cheap however many steps a trail has.
      const counts = new Map<string, number>();
      await db.trailSteps.orderBy("trailId").eachKey((trailId) => {
        const id = String(trailId);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      });

      return trails
        .map((trail) => ({ ...trail, stepCount: counts.get(trail.id) ?? 0 }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    setActiveTrail(trailId) {
      return serialize(() => setActiveTrailId(trailId));
    },

    deleteTrail(trailId) {
      // Through the write queue like every other mutation: deleting the
      // active Trail reassigns which one is active, and a step landing
      // between the delete and the reassignment would attach itself to a
      // Trail that no longer exists.
      return serialize(async () => {
        await db.trailSteps.where("trailId").equals(trailId).delete();
        await db.trails.delete(trailId);

        const active = await db.meta.get(ACTIVE_TRAIL_META_KEY);
        if (active?.value !== trailId) return active?.value ?? (await startUnsafe("Untitled Trail"));

        const remaining = await db.trails.toArray();
        remaining.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        const next = remaining[0];
        if (!next) return startUnsafe("Untitled Trail");
        await setActiveTrailId(next.id);
        return next.id;
      });
    },

    async exportTrail(trailId) {
      const trail = await db.trails.get(trailId);
      if (!trail) return null;
      const steps = await db.trailSteps.where("trailId").equals(trailId).sortBy("order");
      return {
        name: trail.name,
        createdAt: trail.createdAt,
        updatedAt: trail.updatedAt,
        exportedAt: new Date().toISOString(),
        steps: steps.map((s) => ({ refUri: s.refUri, label: s.label, createdAt: s.createdAt })),
      };
    },
  };
}
