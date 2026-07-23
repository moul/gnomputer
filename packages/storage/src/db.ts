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

export class GnomputerDB extends Dexie {
  workspaces!: EntityTable<WorkspaceRecord, "id">;
  trails!: EntityTable<TrailRecord, "id">;
  trailSteps!: EntityTable<TrailStepRecord, "refUri">;
  favorites!: EntityTable<FavoriteRecord, "refUri">;
  meta!: EntityTable<MetaRecord, "key">;
  queryCache!: EntityTable<QueryCacheRecord, "key">;

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
  }
}

export function openDatabase(name = "gnomputer"): GnomputerDB {
  return new GnomputerDB(name);
}
