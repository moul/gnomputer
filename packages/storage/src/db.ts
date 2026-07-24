import Dexie, { type EntityTable } from "dexie";

export interface WorkspaceRecord {
  id: string;
  name: string;
  networkId: string;
  openRefs: string[];
  activeLens?: string;
  updatedAt: string;
}

export interface TrailRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrailStepRecord {
  trailId: string;
  order: number;
  refUri: string;
  label: string;
  createdAt: string;
}

export interface FavoriteRecord {
  refUri: string;
  label: string;
  createdAt: string;
}

export interface MetaRecord {
  key: string;
  value: string;
}

export interface QueryCacheRecord {
  key: string;
  queryKeyJson: string;
  dataJson: string;
  updatedAt: number;
  insertSeq: number;
}

export interface ScriptRecord {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
  /** Monotonic, bumped on every create/update — "most recently updated
   * first" needs a strict order, and two calls in the same test (or the
   * same real event loop tick) can produce an identical updatedAt
   * timestamp at millisecond resolution. */
  updatedSeq: number;
}

export class GnomputerDB extends Dexie {
  workspaces!: EntityTable<WorkspaceRecord, "id">;
  trails!: EntityTable<TrailRecord, "id">;
  trailSteps!: EntityTable<TrailStepRecord, "refUri">;
  favorites!: EntityTable<FavoriteRecord, "refUri">;
  meta!: EntityTable<MetaRecord, "key">;
  queryCache!: EntityTable<QueryCacheRecord, "key">;
  scripts!: EntityTable<ScriptRecord, "id">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      workspaces: "id, networkId",
      trails: "id",
      trailSteps: "[trailId+order], trailId",
      favorites: "refUri",
      meta: "key",
    });
    this.version(2).stores({
      workspaces: "id, networkId",
      trails: "id",
      trailSteps: "[trailId+order], trailId",
      favorites: "refUri",
      meta: "key",
      queryCache: "key, insertSeq",
    });
    this.version(3).stores({
      workspaces: "id, networkId",
      trails: "id",
      trailSteps: "[trailId+order], trailId",
      favorites: "refUri",
      meta: "key",
      queryCache: "key, insertSeq",
      scripts: "id, updatedSeq",
    });
  }
}

export function openDatabase(name = "gnomputer"): GnomputerDB {
  return new GnomputerDB(name);
}
