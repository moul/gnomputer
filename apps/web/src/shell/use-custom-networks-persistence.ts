import { useCustomNetworksStore } from "./custom-networks-store";
import { useStorePersistence } from "./use-store-persistence";
import type { NetworkConfig } from "@gnomputer/app-sdk";

const STORAGE_KEY = "custom-networks";

function isNetworkConfig(value: unknown): value is NetworkConfig {
  if (typeof value !== "object" || value === null) return false;
  const n = value as Record<string, unknown>;
  return typeof n.id === "string" && typeof n.name === "string" && typeof n.rpcUrl === "string";
}

function deserialize(raw: string): { networks: NetworkConfig[] } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return { networks: parsed.filter(isNetworkConfig) };
  } catch {
    return null;
  }
}

/** Returns whether the stored list has been read yet — the difference
 * between "you have no custom networks" and "we haven't looked". */
export function useCustomNetworksPersistence(): boolean {
  return useStorePersistence(STORAGE_KEY, useCustomNetworksStore, {
    serialize: (state) => JSON.stringify(state.networks),
    deserialize,
  });
}
