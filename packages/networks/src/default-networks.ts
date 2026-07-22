import type { NetworkConfig } from "./network-config";

export const DEFAULT_NETWORK_ID = "topaz";

function withWebsocket(rpcUrl: string): string {
  return rpcUrl.replace(/^http/, "ws") + "/websocket";
}

export const DEFAULT_NETWORKS: NetworkConfig[] = [
  {
    id: "topaz",
    name: "Topaz (official testnet)",
    chainId: "topaz-1",
    // The user-facing URL (topaz.testnets.gno.land) is gnoweb, not the RPC —
    // confirmed live: it 303-redirects and its CSP header points at an
    // internal-only RPC host. The public RPC follows the same
    // rpc.<name>.testnets.gno.land convention as Test13.
    rpcUrl: "https://rpc.topaz.testnets.gno.land",
    websocketUrl: withWebsocket("https://rpc.topaz.testnets.gno.land"),
    gnowebUrl: "https://topaz.testnets.gno.land",
    indexerGraphqlUrl: "https://indexer.topaz.testnets.gno.land/graphql/query",
    environment: "testnet",
    persistence: "rolling",
    trust: "official",
    capabilities: ["network.read", "indexer.read"],
  },
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
          "No public transaction indexer is configured for this network yet; recent activity is derived by polling block headers, and transaction contents are not decoded.",
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
