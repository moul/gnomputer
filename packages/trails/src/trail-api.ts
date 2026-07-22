import type { GnomputerDB, TrailStepRecord } from "@gnomputer/storage";

export interface TrailAPI {
  start(name: string): Promise<string>;
  addStep(trailId: string, refUri: string, label: string): Promise<void>;
  rename(trailId: string, name: string): Promise<void>;
  getSteps(trailId: string): Promise<TrailStepRecord[]>;
  getActiveTrailId(): Promise<string | null>;
}

function newId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `trail-${random}`;
}

export function createTrailApi(db: GnomputerDB): TrailAPI {
  let activeTrailId: string | null = null;

  return {
    async start(name) {
      const id = newId();
      const now = new Date().toISOString();
      await db.trails.put({ id, name, createdAt: now, updatedAt: now });
      activeTrailId = id;
      return id;
    },

    async addStep(trailId, refUri, label) {
      const existing = await db.trailSteps.where("trailId").equals(trailId).count();
      await db.trailSteps.put({
        trailId,
        order: existing,
        refUri,
        label,
        createdAt: new Date().toISOString(),
      });
      await db.trails.update(trailId, { updatedAt: new Date().toISOString() });
    },

    async rename(trailId, name) {
      await db.trails.update(trailId, { name, updatedAt: new Date().toISOString() });
    },

    async getSteps(trailId) {
      return db.trailSteps.where("trailId").equals(trailId).sortBy("order");
    },

    async getActiveTrailId() {
      return activeTrailId;
    },
  };
}
