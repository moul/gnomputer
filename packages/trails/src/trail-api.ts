import type { GnomputerDB, TrailStepRecord } from "@gnomputer/storage";

export interface TrailAPI {
  start(name: string): Promise<string>;
  addStep(trailId: string, refUri: string, label: string): Promise<void>;
  rename(trailId: string, name: string): Promise<void>;
  getSteps(trailId: string): Promise<TrailStepRecord[]>;
  getActiveTrailId(): Promise<string | null>;
  ensureActiveTrailId(defaultName: string): Promise<string>;
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
  };
}
