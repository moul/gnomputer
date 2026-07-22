import { parseGnoUri, formatGnoUri } from "@gnomputer/entities";
import { DEFAULT_NETWORKS, DEFAULT_NETWORK_ID, type NetworkConfig } from "@gnomputer/networks";
import { createRpcClient, type RpcClient, type BlockSummary, type AccountInfo } from "@gnomputer/rpc";

export type { RpcClient, BlockSummary, AccountInfo };
import { openDatabase, type WorkspaceRecord, type FavoriteRecord } from "@gnomputer/storage";
import { createTrailApi, type TrailAPI } from "@gnomputer/trails";
import { availableLenses, parseRenderMarkup } from "@gnomputer/lenses";

export interface GnomputerSDK {
  networks: {
    list(): NetworkConfig[];
    getDefault(): NetworkConfig;
    getActive(): NetworkConfig;
    setActive(id: string): void;
  };
  readonly rpc: RpcClient;
  trails: TrailAPI;
  entities: { parse: typeof parseGnoUri; format: typeof formatGnoUri };
  lenses: { available: typeof availableLenses; parseRender: typeof parseRenderMarkup };
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
}

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
    trails: trailApi,
    entities: { parse: parseGnoUri, format: formatGnoUri },
    lenses: { available: availableLenses, parseRender: parseRenderMarkup },
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
  };
}
