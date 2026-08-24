import type { NetworkConfig } from "./network-config";

/**
 * The network a session starts on when it has no stored choice.
 *
 * Sapphire, the newest official testnet. #199 added it but deliberately left
 * this on Topaz so that *gaining* a network would not move anyone's chain out
 * from under them; moving it is now the deliberate step. That safeguard still
 * applies either way — a stored `active-network` always wins (AUD-013), so
 * this only decides where a first visit, or one whose storage was cleared,
 * lands.
 *
 * DEFAULT_NETWORKS below is ordered to match: the default leads the list, and
 * that order is what the network picker renders.
 */
export const DEFAULT_NETWORK_ID = "sapphire";

function withWebsocket(rpcUrl: string): string {
  return rpcUrl.replace(/^http/, "ws") + "/websocket";
}

export const DEFAULT_NETWORKS: NetworkConfig[] = [
  {
    id: "sapphire",
    name: "Sapphire (official testnet)",
    shortName: "Sapphire",
    // Sapphire blue — the stone the testnet is named after.
    color: "#2f6fd0",
    chainId: "sapphire-1",
    rpcUrl: "https://rpc.sapphire.testnets.gno.land",
    websocketUrl: withWebsocket("https://rpc.sapphire.testnets.gno.land"),
    gnowebUrl: "https://sapphire.testnets.gno.land",
    // NOT the `/graphql` in the announcement — that path serves the GraphQL
    // *playground* (an HTML page), so the app would have been parsing markup
    // as JSON. `/graphql/query` is the API, same convention as Topaz, and
    // answers `{ latestBlockHeight }` with real data. Confirmed live, along
    // with `access-control-allow-origin: *` (so ADR-018 holds here too) and
    // the full getTransactions message union the Block Explorer needs.
    indexerGraphqlUrl: "https://indexer.sapphire.testnets.gno.land/graphql/query",
    gnockpitUrl: "https://gnockpit.sapphire.testnets.gno.land",
    // Not in the announcement, but deployed and serving the real mygnoscan
    // for this chain — confirmed live by its page title, the same check the
    // Topaz entry below rests on.
    explorerUrl: "https://explorer.sapphire.testnets.gno.land",
    statusUrl: "https://status.sapphire.testnets.gno.land",
    environment: "testnet",
    // Assumed to match Topaz, the testnet it sits alongside. Nothing in the
    // announcement states a retention policy, and a rolling claim is the
    // conservative one: it warns that history may not go back forever
    // rather than promising it does.
    persistence: "rolling",
    trust: "official",
    capabilities: ["network.read", "indexer.read"],
  },
  {
    id: "topaz",
    name: "Topaz (official testnet)",
    shortName: "Topaz",
    // Imperial topaz, the golden-orange variety.
    color: "#d98d2b",
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
    id: "betanet",
    name: "Betanet",
    shortName: "Betanet",
    // Not a gemstone: gno.land's own green, so it reads as the odd one out
    // among the testnets rather than as a third stone.
    color: "#2f9e6f",
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
    shortName: "gnodev",
    // Deliberately colourless — it is whatever is running on your machine.
    color: "#8a8f98",
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
