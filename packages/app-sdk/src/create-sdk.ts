import { parseGnoUri, formatGnoUri } from "@gnomputer/entities";
import { DEFAULT_NETWORKS, DEFAULT_NETWORK_ID, type NetworkConfig } from "@gnomputer/networks";

export { DEFAULT_NETWORK_ID };
export type { NetworkConfig };
import {
  createRpcClient,
  listRealms,
  countPackagesByCreator,
  realmHistory,
  chainActivityStats,
  dailyActivity,
  listTransactions,
  listBlockHeightsWithTxs,
  recentEvents,
  type RpcClient,
  type BlockSummary,
  type AccountInfo,
  type ValidatorInfo,
  type ValidatorSet,
  type RealmSummary,
  type IndexerEvent,
  type IndexerRecentEvent,
  type ChainActivityStats,
  type DailyActivity,
  type IndexerTransaction,
  type ChainEvent,
  type BlockTxResult,
  type BlockEvents,
} from "@gnomputer/rpc";
// Re-exported so apps can type against provenance without depending on
// @gnomputer/core directly — app-sdk is the one surface they may import.
import type { DataEnvelope } from "@gnomputer/core";
export type { DataEnvelope };

// Re-exported for the same reason as DataEnvelope: apps are not allowed to
// import @gnomputer/rpc directly, but they do need to branch on why a chain
// query failed.
export { GnoABCIError, InvalidPkgPathError, NoRenderDeclError } from "@gnomputer/rpc";

export type {
  RpcClient,
  BlockSummary,
  AccountInfo,
  ValidatorInfo,
  ValidatorSet,
  RealmSummary,
  IndexerEvent,
  IndexerRecentEvent,
  ChainActivityStats,
  DailyActivity,
  IndexerTransaction,
  ChainEvent,
  BlockTxResult,
  BlockEvents,
};
import {
  openDatabase,
  type FavoriteRecord,
  type ScriptRecord,
} from "@gnomputer/storage";

export type { ScriptRecord, FavoriteRecord };
import { createTrailApi, type TrailAPI, type TrailSummary, type TrailExport } from "@gnomputer/trails";

export type { TrailSummary, TrailExport };
import {
  availableLenses,
  parseRenderMarkup,
  parseImports,
  isChainPackage,
  parseExportedSymbols,
  parseUserData,
  type ParsedImport,
  type ExportedSymbol,
  type ParsedUserData,
} from "@gnomputer/lenses";

export type { ParsedImport, ExportedSymbol, ParsedUserData };

export interface GnomputerSDK {
  networks: {
    list(): NetworkConfig[];
    getDefault(): NetworkConfig;
    getActive(): NetworkConfig;
    setActive(id: string): void;
    /** Switches to a full network config directly rather than an id looked
     * up in list() — the one entry point that works for both a known
     * default network and a user-added custom one (custom networks aren't
     * tracked inside the SDK itself; see apps/web's custom-networks-store,
     * which persists them and passes the resolved config here). */
    setActiveConfig(config: NetworkConfig): void;
  };
  readonly rpc: RpcClient;
  indexer: {
    listRealms(): Promise<DataEnvelope<RealmSummary[]>>;
    countPackagesByCreator(address: string): Promise<DataEnvelope<{ count: number }>>;
    realmHistory(packagePath: string): Promise<DataEnvelope<IndexerEvent[]>>;
    chainActivityStats(): Promise<DataEnvelope<ChainActivityStats>>;
    dailyActivity(): Promise<DataEnvelope<DailyActivity[]>>;
    listTransactions(): Promise<DataEnvelope<IndexerTransaction[]>>;
    /** Heights of the most recent blocks containing transactions, newest
     * first. Indexer-only; throws on a network without one. */
    blockHeightsWithTxs(limit?: number): Promise<DataEnvelope<number[]>>;
    recentEvents(): Promise<DataEnvelope<IndexerRecentEvent[]>>;
  };
  trails: TrailAPI;
  entities: { parse: typeof parseGnoUri; format: typeof formatGnoUri };
  lenses: {
    available: typeof availableLenses;
    parseRender: typeof parseRenderMarkup;
    parseImports: typeof parseImports;
    isChainPackage: typeof isChainPackage;
    parseExportedSymbols: typeof parseExportedSymbols;
    parseUserData: typeof parseUserData;
  };
  favorites: {
    list(): Promise<FavoriteRecord[]>;
    /** Idempotent, and serialized against other favorite writes.
     *
     * This was `toggle(refUri, label)`, which re-derived from the database
     * a decision the caller had already made — a read-modify-write with no
     * ordering guarantee. Two toggles in one tick (an impatient
     * double-click) both read "not favorited", both wrote, and the UI and
     * the database disagreed permanently: the star read unstarred, the row
     * was there, and a reload brought it back.
     *
     * Taking the desired state as an argument removes the read, and the
     * queue keeps two writes for the same refUri in the order they were
     * requested so the last one wins. */
    set(refUri: string, label: string, favorite: boolean): Promise<void>;
  };
  uiState: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
  queryCache: {
    getAll(): Promise<{ queryKeyJson: string; data: unknown; updatedAt: number }[]>;
    set(queryKeyJson: string, data: unknown, updatedAt: number): Promise<void>;
  };
  scripts: {
    /** Most recently updated first. */
    list(): Promise<ScriptRecord[]>;
    create(name: string, code: string): Promise<ScriptRecord>;
    update(id: string, patch: { name?: string; code?: string }): Promise<void>;
    remove(id: string): Promise<void>;
  };
}

// "Instant last-known value on reload, refetch in the background" only needs
// the last successful result per query — capped well below what IndexedDB
// could hold, so a session that opens many different realms/blocks doesn't
// grow this table forever.
const QUERY_CACHE_MAX_ENTRIES = 50;
/** Bump when the shape of a cached query result changes in a way older
 * entries cannot satisfy. Rows written under a different version are
 * dropped on read instead of being handed to code that expects the new
 * shape.
 *
 * 2: indexer-backed queries now cache the whole DataEnvelope rather than
 * just its .data, so Freshness can report where the data came from. A v1
 * entry would deserialise into code expecting `.data` and `.source` and
 * find neither. */
const QUERY_CACHE_SCHEMA_VERSION = 2;

/** Storage is best-effort. When it is unavailable — Firefox private
 * browsing, a locked-down enterprise profile, a full quota — the app is
 * designed to keep working without it, and it does: verified with
 * IndexedDB throwing on access, the desktop boots, windows open and chain
 * data loads.
 *
 * What it also did was throw 32 unhandled rejections in the first nine
 * seconds, because every preference and cache write is fire-and-forget.
 * They broke nothing, but that volume drowns the console and would make
 * any error-reporting integration useless, hiding the failures that
 * matter behind a condition the app has already handled.
 *
 * So: swallowed, and reported exactly once. Reads return null on failure,
 * which callers already treat as "nothing stored". */
let warnedAboutStorage = false;

function bestEffort(operation: Promise<unknown>): Promise<void> {
  return operation.then(
    () => undefined,
    (error: unknown) => {
      if (!warnedAboutStorage) {
        warnedAboutStorage = true;
        console.warn(
          "Local storage is unavailable, so preferences and the offline cache won't persist. Everything else works.",
          error
        );
      }
    }
  );
}

export function createGnomputerSDK(
  options: { networkId?: string; dbName?: string } = {}
): GnomputerSDK {
  const db = openDatabase(options.dbName);
  const trailApi = createTrailApi(db);

  // Same reasoning as the Trail write queue: IndexedDB writes here are
  // ordered by when they are *requested*, not by when they happen to
  // resolve, so two rapid stars of the same realm cannot land backwards.
  let favoriteWrites: Promise<unknown> = Promise.resolve();
  function serializeFavoriteWrite(fn: () => Promise<void>): Promise<void> {
    const result = favoriteWrites.then(fn, fn);
    favoriteWrites = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  let activeNetwork =
    DEFAULT_NETWORKS.find((n) => n.id === (options.networkId ?? DEFAULT_NETWORK_ID)) ??
    DEFAULT_NETWORKS.find((n) => n.id === DEFAULT_NETWORK_ID)!;
  let rpc = createRpcClient(activeNetwork);

  return {
    networks: {
      list: () => DEFAULT_NETWORKS,
      getDefault: () => DEFAULT_NETWORKS.find((n) => n.id === DEFAULT_NETWORK_ID)!,
      getActive: () => activeNetwork,
      setActive: (id: string) => {
        const next = DEFAULT_NETWORKS.find((n) => n.id === id);
        if (!next) throw new Error(`Unknown network id "${id}"`);
        activeNetwork = next;
        rpc = createRpcClient(activeNetwork);
      },
      setActiveConfig: (config: NetworkConfig) => {
        activeNetwork = config;
        rpc = createRpcClient(activeNetwork);
      },
    },
    get rpc() {
      return rpc;
    },
    indexer: {
      listRealms: () => listRealms(activeNetwork, new Date().toISOString()),
      countPackagesByCreator: (address) =>
        countPackagesByCreator(activeNetwork, address, new Date().toISOString()),
      realmHistory: (packagePath) =>
        realmHistory(activeNetwork, packagePath, new Date().toISOString()),
      chainActivityStats: () => chainActivityStats(activeNetwork, new Date().toISOString()),
      dailyActivity: () => dailyActivity(activeNetwork, new Date().toISOString()),
      listTransactions: () => listTransactions(activeNetwork, new Date().toISOString()),
      blockHeightsWithTxs: (limit) =>
        listBlockHeightsWithTxs(activeNetwork, new Date().toISOString(), limit),
      recentEvents: () => recentEvents(activeNetwork, new Date().toISOString()),
    },
    trails: trailApi,
    entities: { parse: parseGnoUri, format: formatGnoUri },
    lenses: {
      available: availableLenses,
      parseRender: parseRenderMarkup,
      parseImports,
      isChainPackage,
      parseExportedSymbols,
      parseUserData,
    },
    favorites: {
      list: () => db.favorites.toArray(),
      set: (refUri, label, favorite) =>
        serializeFavoriteWrite(async () => {
          if (!favorite) {
            await db.favorites.delete(refUri);
            return;
          }
          // Re-starring something already starred keeps its original
          // createdAt, so the Browser home's newest-first order doesn't
          // reshuffle on a no-op write. Safe to read here: this whole
          // function runs inside the queue.
          const existing = await db.favorites.get(refUri);
          await db.favorites.put({
            refUri,
            label,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
          });
        }),
    },
    uiState: {
      // Shares the `meta` Dexie table with internal SDK state (e.g. Trails'
      // activeTrailId) — namespaced so an app-chosen key can never collide
      // with one of those.
      get: async (key) => {
        try {
          const record = await db.meta.get(`uiState:${key}`);
          return record?.value ?? null;
        } catch {
          // Indistinguishable from "nothing stored", which is the right
          // behaviour when storage cannot be read at all.
          return null;
        }
      },
      set: async (key, value) => {
        await bestEffort(db.meta.put({ key: `uiState:${key}`, value }));
      },
    },
    queryCache: {
      getAll: async () => {
        let records;
        try {
          records = await db.queryCache.orderBy("insertSeq").toArray();
        } catch {
          // No readable cache is the same as an empty one.
          return [];
        }

        // Parsed per row, not in a map() that throws for the whole batch.
        // One unparseable row used to reject getAll(), which took down the
        // caller's whole hydration — and because that caller sets its
        // "hydrated" flag at the end of the same block, the failure also
        // stopped the cache SAVING anything for the rest of the session.
        // A single bad row disabled the feature until storage was cleared
        // (AUD-006).
        const good: { queryKeyJson: string; data: unknown; updatedAt: number }[] = [];
        const quarantine: string[] = [];
        for (const record of records) {
          if ((record.schemaVersion ?? 0) !== QUERY_CACHE_SCHEMA_VERSION) {
            quarantine.push(record.key);
            continue;
          }
          try {
            good.push({
              queryKeyJson: record.queryKeyJson,
              data: JSON.parse(record.dataJson),
              updatedAt: record.updatedAt,
            });
          } catch {
            quarantine.push(record.key);
          }
        }
        // Deleted rather than merely skipped: a row that cannot be parsed
        // will never become parseable, so leaving it costs this scan on
        // every boot forever and keeps occupying one of the 50 slots.
        if (quarantine.length > 0) void bestEffort(db.queryCache.bulkDelete(quarantine));
        return good;
      },
      set: async (queryKeyJson, data, updatedAt) => {
        await bestEffort(
          (async () => {
            const existing = await db.queryCache.get(queryKeyJson);
            if (existing) {
              // True FIFO: updating a key's data does not move it back to the
              // front of the eviction queue — only first-seen order matters.
              await db.queryCache.put({
                ...existing,
                dataJson: JSON.stringify(data),
                updatedAt,
                schemaVersion: QUERY_CACHE_SCHEMA_VERSION,
              });
              return;
            }
            const count = await db.queryCache.count();
            if (count >= QUERY_CACHE_MAX_ENTRIES) {
              const oldest = await db.queryCache.orderBy("insertSeq").first();
              if (oldest) await db.queryCache.delete(oldest.key);
            }
            const newest = await db.queryCache.orderBy("insertSeq").last();
            await db.queryCache.put({
              key: queryKeyJson,
              queryKeyJson,
              dataJson: JSON.stringify(data),
              updatedAt,
              insertSeq: (newest?.insertSeq ?? 0) + 1,
              schemaVersion: QUERY_CACHE_SCHEMA_VERSION,
            });
          })()
        );
      },
    },
    scripts: {
      list: async () => {
        const all = await db.scripts.toArray();
        return all.sort((a, b) => b.updatedSeq - a.updatedSeq);
      },
      create: async (name, code) => {
        const now = new Date().toISOString();
        const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
        const newest = await db.scripts.orderBy("updatedSeq").last();
        const record: ScriptRecord = {
          id: `script-${random}`,
          name,
          code,
          createdAt: now,
          updatedAt: now,
          updatedSeq: (newest?.updatedSeq ?? 0) + 1,
        };
        await db.scripts.put(record);
        return record;
      },
      update: async (id, patch) => {
        const existing = await db.scripts.get(id);
        if (!existing) return;
        const newest = await db.scripts.orderBy("updatedSeq").last();
        await db.scripts.put({
          ...existing,
          ...patch,
          updatedAt: new Date().toISOString(),
          updatedSeq: (newest?.updatedSeq ?? 0) + 1,
        });
      },
      remove: async (id) => {
        await db.scripts.delete(id);
      },
    },
  };
}
