import { parseGnoUri, formatGnoUri } from "@gnomputer/entities";
import { DEFAULT_NETWORKS, DEFAULT_NETWORK_ID, type NetworkConfig } from "@gnomputer/networks";

export { DEFAULT_NETWORK_ID };
export type { NetworkConfig };
import {
  createRpcClient,
  listRealms,
  countPackagesByCreator,
  type RpcClient,
  type BlockSummary,
  type AccountInfo,
  type ValidatorInfo,
  type ValidatorSet,
  type RealmSummary,
  type ChainEvent,
  type BlockTxResult,
  type BlockEvents,
} from "@gnomputer/rpc";
import type { DataEnvelope } from "@gnomputer/core";

export type {
  RpcClient,
  BlockSummary,
  AccountInfo,
  ValidatorInfo,
  ValidatorSet,
  RealmSummary,
  ChainEvent,
  BlockTxResult,
  BlockEvents,
};
import { openDatabase, type WorkspaceRecord, type FavoriteRecord } from "@gnomputer/storage";
import { createTrailApi, type TrailAPI } from "@gnomputer/trails";
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
  };
  readonly rpc: RpcClient;
  indexer: {
    listRealms(): Promise<DataEnvelope<RealmSummary[]>>;
    countPackagesByCreator(address: string): Promise<DataEnvelope<{ count: number }>>;
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
  workspaces: {
    get(id: string): Promise<WorkspaceRecord | undefined>;
    save(record: WorkspaceRecord): Promise<void>;
  };
  favorites: {
    list(): Promise<FavoriteRecord[]>;
    toggle(refUri: string, label: string): Promise<void>;
  };
  uiState: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
  queryCache: {
    getAll(): Promise<{ queryKeyJson: string; data: unknown; updatedAt: number }[]>;
    set(queryKeyJson: string, data: unknown, updatedAt: number): Promise<void>;
  };
}

// "Instant last-known value on reload, refetch in the background" only needs
// the last successful result per query — capped well below what IndexedDB
// could hold, so a session that opens many different realms/blocks doesn't
// grow this table forever.
const QUERY_CACHE_MAX_ENTRIES = 50;

export function createGnomputerSDK(
  options: { networkId?: string; dbName?: string } = {}
): GnomputerSDK {
  const db = openDatabase(options.dbName);
  const trailApi = createTrailApi(db);

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
    },
    get rpc() {
      return rpc;
    },
    indexer: {
      listRealms: () => listRealms(activeNetwork, new Date().toISOString()),
      countPackagesByCreator: (address) =>
        countPackagesByCreator(activeNetwork, address, new Date().toISOString()),
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
    workspaces: {
      get: (id) => db.workspaces.get(id),
      save: (record) => db.workspaces.put(record).then(() => undefined),
    },
    favorites: {
      list: () => db.favorites.toArray(),
      toggle: async (refUri, label) => {
        const existing = await db.favorites.get(refUri);
        if (existing) {
          await db.favorites.delete(refUri);
        } else {
          await db.favorites.put({ refUri, label, createdAt: new Date().toISOString() });
        }
      },
    },
    uiState: {
      // Shares the `meta` Dexie table with internal SDK state (e.g. Trails'
      // activeTrailId) — namespaced so an app-chosen key can never collide
      // with one of those.
      get: async (key) => {
        const record = await db.meta.get(`uiState:${key}`);
        return record?.value ?? null;
      },
      set: async (key, value) => {
        await db.meta.put({ key: `uiState:${key}`, value });
      },
    },
    queryCache: {
      getAll: async () => {
        const records = await db.queryCache.orderBy("insertSeq").toArray();
        return records.map((r) => ({
          queryKeyJson: r.queryKeyJson,
          data: JSON.parse(r.dataJson),
          updatedAt: r.updatedAt,
        }));
      },
      set: async (queryKeyJson, data, updatedAt) => {
        const existing = await db.queryCache.get(queryKeyJson);
        if (existing) {
          // True FIFO: updating a key's data does not move it back to the
          // front of the eviction queue — only first-seen order matters.
          await db.queryCache.put({ ...existing, dataJson: JSON.stringify(data), updatedAt });
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
        });
      },
    },
  };
}
