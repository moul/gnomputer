import type { NetworkConfig } from "./network-config";

export const DEFAULT_NETWORK_ID = "test13";

function withWebsocket(rpcUrl: string): string {
  return rpcUrl.replace(/^http/, "ws") + "/websocket";
}

export const DEFAULT_NETWORKS: NetworkConfig[] = [
  {
    id: "test13",
    name: "Test13 (official testnet)",
    chainId: "test-13",
    rpcUrl: "https://rpc.test13.testnets.gno.land",
    websocketUrl: withWebsocket("https://rpc.test13.testnets.gno.land"),
    gnowebUrl: "https://test13.testnets.gno.land",
    environment: "testnet",
    persistence: "rolling",
    trust: "official",
    capabilities: ["network.read"],
    warnings: [
      {
        code: "indexed-history-unavailable",
        message:
          "No public transaction indexer is configured for this network yet; recent activity is derived from live block/transaction subscription only.",
      },
    ],
  },
  {
    id: "betanet",
    name: "Betanet",
    chainId: "gnoland1",
    rpcUrl: "https://rpc.gno.land",
    websocketUrl: withWebsocket("https://rpc.gno.land"),
    gnowebUrl: "https://gno.land",
    environment: "betanet",
    persistence: "persistent",
    trust: "official",
    capabilities: ["network.read"],
  },
];
