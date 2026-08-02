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
  };
}
