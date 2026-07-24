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
    gnockpitUrl: "https://gnockpit.topaz.testnets.gno.land",
    // mygnoscan, deployed for this network — confirmed reachable live. Its
    // own /api/* routes send no Access-Control-Allow-Origin header either
    // (confirmed the same way as indexerGraphqlUrl below), so this is
    // currently a browser link out, not a fetchable data source.
    explorerUrl: "https://explorer.topaz.testnets.gno.land",
    statusUrl: "https://status.topaz.testnets.gno.land",
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
    gnockpitUrl: "https://gnockpit.test13.testnets.gno.land",
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
    // Community-run (moul), not an official gno.land subdomain like the
    // testnets' — confirmed reachable live, kept separate from `trust`
    // below which describes the network itself, not these companion tools.
    gnockpitUrl: "https://gnockpit.gnoland1.moul.p2p.team",
    explorerUrl: "https://mygnoscan.gnoland1.moul.p2p.team",
    environment: "betanet",
    persistence: "persistent",
    trust: "official",
    capabilities: ["network.read"],
  },
  {
    id: "gnodev",
    name: "gnodev (local)",
    chainId: "dev",
    // gnodev's documented defaults: a Tendermint2 RPC on 26657 and a bundled
    // gnoweb on 8888. Only reachable if the user has `gnodev` running on
    // their own machine — not verifiable from here, so this entry exists to
    // be selected when it applies rather than assumed active by default.
    rpcUrl: "http://127.0.0.1:26657",
    websocketUrl: withWebsocket("http://127.0.0.1:26657"),
    gnowebUrl: "http://127.0.0.1:8888",
    environment: "local",
    persistence: "ephemeral",
    trust: "local",
    capabilities: ["network.read"],
  },
];
