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

/** Builds a full NetworkConfig for a user-supplied custom network.
 *
 * persistence and trust stay "unknown"/"custom" — a custom node could be
 * anything, and claiming otherwise would be a guarantee this app cannot
 * back. The chain ID is different: it is *discovered* by probing the
 * endpoint (probe-network.ts) rather than guessed, and passing it in is
 * what makes a custom network signable at all — transaction-intent refuses
 * to sign against a chain ID of "unknown", so before this every custom
 * network was permanently read-only whether or not it was legitimate.
 *
 * A stable id is derived from the name so re-adding the same name updates
 * rather than duplicating. */
export function buildCustomNetworkConfig(
  name: string,
  rpcUrl: string,
  chainId = "unknown"
): NetworkConfig {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    id: `custom-${slug || Date.now()}`,
    name: name.trim(),
    chainId,
    rpcUrl,
    environment: "custom",
    persistence: "unknown",
    trust: "custom",
    capabilities: [],
  };
}
