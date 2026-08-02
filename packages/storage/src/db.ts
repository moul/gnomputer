import Dexie, { type EntityTable } from "dexie";

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
  /** Which cache format this row was written in. Rows from a different
   * version are dropped on read rather than fed to code that expects a
   * shape they may not have. Not indexed, so adding it needed no Dexie
   * version bump — only indexes have to be declared. */
  schemaVersion?: number;
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
  trails!: EntityTable<TrailRecord, "id">;
  /* No id-property type argument: this table's primary key is the compound
     index [trailId+order], not a single field. Naming "refUri" here — which
     is neither the primary key nor unique across trails — made add() treat
     refUri as optional, and would have made get(refUri) type-check while
     never matching anything. */
  trailSteps!: EntityTable<TrailStepRecord>;
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
    // v4 drops `workspaces` (AUD-044). The table shipped in v1 with an SDK
    // to match and no UI ever wrote to it, so there is nothing to migrate —
    // but the declaration is what made the architecture claim a feature the
    // app did not have, and the crash-recovery screen once promised to
    // preserve data nobody could create.
    //
    // A named workspace is worth building later. It should be re-derived
    // from the URL/layout schema that shareable state introduced (#139:
    // ?pkg=…&lens=…&net=…), which already carries most of what
    // WorkspaceRecord did, rather than kept alive here as a second,
    // competing notion of "the state I'm in".
    //
    // Dexie requires the explicit null: leaving the table out of a new
    // version keeps it in the file rather than removing it.
    this.version(4).stores({
      workspaces: null,
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
