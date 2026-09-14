import type { NetworkConfig } from "./network-config";

/**
 * The network a session starts on when it has no stored choice.
 *
 * Mainnet, the live gno.land chain — the network most visitors actually want,
 * rather than a testnet they'd have to switch off of. Pearl (the current
 * official testnet) and Staging stay a menu entry away, and gnodev is there
 * for anyone running it locally. A stored `active-network` always wins
 * (AUD-013), so this only decides where a first visit — or one whose storage
 * was cleared — lands, and nobody is moved off the chain they picked.
 *
 * DEFAULT_NETWORKS below is ordered to match: the default leads the list, and
 * that order is what the network picker renders.
 */
export const DEFAULT_NETWORK_ID = "mainnet";

function withWebsocket(rpcUrl: string): string {
  return rpcUrl.replace(/^http/, "ws") + "/websocket";
}

export const DEFAULT_NETWORKS: NetworkConfig[] = [
  {
    id: "mainnet",
    name: "Mainnet",
    shortName: "Mainnet",
    // Not a gemstone: gno.land's own green, so it reads as the odd one out
    // among the gemstone-named networks rather than as one of them.
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
    environment: "mainnet",
    persistence: "persistent",
    trust: "official",
    capabilities: ["network.read"],
  },
  {
    id: "pearl",
    name: "Pearl (official testnet)",
    shortName: "Pearl",
    // A pearl's lustre rather than its body colour: cream on white would be
    // invisible on the light themes, and the dot has to read on both.
    color: "#b8829e",
    chainId: "pearl-1",
    // `rpc.<name>.testnets.gno.land` — not the `pearl.gno.land` the
    // tx-exports CI change suggested, which does not resolve. Confirmed
    // live: chain `pearl-1`, v1.0.0-rc.0.
    rpcUrl: "https://rpc.pearl.testnets.gno.land",
    websocketUrl: withWebsocket("https://rpc.pearl.testnets.gno.land"),
    gnowebUrl: "https://pearl.testnets.gno.land",
    // `/graphql/query`, not `/graphql` — the latter serves the GraphQL
    // playground as HTML, and pointing the app at it would feed markup to a
    // JSON parser. Confirmed live: it answers `{ latestBlockHeight }` with
    // real data, a cross-origin read from the deployed app succeeds (so
    // ADR-018 holds here too), and the full getTransactions message union
    // the Block Explorer needs resolves.
    indexerGraphqlUrl: "https://indexer.pearl.testnets.gno.land/graphql/query",
    gnockpitUrl: "https://gnockpit.pearl.testnets.gno.land",
    explorerUrl: "https://explorer.pearl.testnets.gno.land",
    statusUrl: "https://status.pearl.testnets.gno.land",
    environment: "testnet",
    // Same conservative claim as Staging: nothing states a retention policy,
    // and "rolling" warns that history may not go back forever rather than
    // promising it does.
    persistence: "rolling",
    trust: "official",
    capabilities: ["network.read", "indexer.read"],
  },
  {
    id: "staging",
    name: "Staging",
    shortName: "Staging",
    // A muted amber: distinct from Mainnet's green, Pearl's pink, and
    // gnodev's grey, and reads as "pre-production" rather than a gemstone.
    color: "#c9862f",
    // Genesis reports chain_id "staging" (confirmed live via
    // rpc.staging.gno.land/genesis); node_info's moniker is
    // "the-staging-chain".
    chainId: "staging",
    rpcUrl: "https://rpc.staging.gno.land",
    websocketUrl: withWebsocket("https://rpc.staging.gno.land"),
    gnowebUrl: "https://staging.gno.land",
    // No indexer, gnockpit, explorer, or status subdomain for this chain —
    // confirmed by connection failures on all four (unlike the testnets'
    // rpc.<name>.testnets.gno.land companions), so those fields are left
    // unset rather than pointed at hosts that don't resolve.
    environment: "staging",
    persistence: "rolling",
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
