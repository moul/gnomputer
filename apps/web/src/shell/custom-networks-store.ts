import { create } from "zustand";
import type { NetworkConfig } from "@gnomputer/app-sdk";

interface CustomNetworksState {
  networks: NetworkConfig[];
  addNetwork: (network: NetworkConfig) => void;
  removeNetwork: (id: string) => void;
}

export const useCustomNetworksStore = create<CustomNetworksState>((set) => ({
  networks: [],
  addNetwork: (network) => set((s) => ({ networks: [...s.networks, network] })),
  removeNetwork: (id) => set((s) => ({ networks: s.networks.filter((n) => n.id !== id) })),
}));

/** Builds a full NetworkConfig for a user-supplied custom network from just
 * a name + RPC URL — everything else defaults to values that mean "unknown,
 * this is user-supplied" rather than claiming a guarantee this app can't
 * actually back (persistence/trust in particular: a custom node could be
 * anything). A stable id is derived from the name so re-adding the same
 * name updates rather than duplicating. */
export function buildCustomNetworkConfig(name: string, rpcUrl: string): NetworkConfig {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    id: `custom-${slug || Date.now()}`,
    name: name.trim(),
    chainId: "unknown",
    rpcUrl,
    environment: "custom",
    persistence: "unknown",
    trust: "custom",
    capabilities: [],
  };
}
