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

export class GnomputerDB extends Dexie {
  workspaces!: EntityTable<WorkspaceRecord, "id">;
  trails!: EntityTable<TrailRecord, "id">;
  trailSteps!: EntityTable<TrailStepRecord, "refUri">;
  favorites!: EntityTable<FavoriteRecord, "refUri">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      workspaces: "id, networkId",
      trails: "id",
      trailSteps: "[trailId+order], trailId",
      favorites: "refUri",
    });
  }
}

export function openDatabase(name = "gnomputer"): GnomputerDB {
  return new GnomputerDB(name);
}
