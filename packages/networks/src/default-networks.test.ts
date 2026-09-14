import { describe, it, expect } from "vitest";
import { DEFAULT_NETWORKS, DEFAULT_NETWORK_ID } from "./default-networks";
import { networkShortName } from "./network-config";

describe("networkShortName", () => {
  it("prefers an explicit shortName", () => {
    expect(networkShortName({ name: "Pearl (official testnet)", shortName: "Pearl" })).toBe(
      "Pearl"
    );
  });

  it("falls back to the name without its trailing qualifier", () => {
    // Custom networks are stored as whole configs and predate shortName, so
    // the fallback is what most stored entries actually go through.
    expect(networkShortName({ name: "Mock (e2e)" })).toBe("Mock");
    expect(networkShortName({ name: "Pearl (official testnet)" })).toBe("Pearl");
  });

  it("leaves a name with no qualifier alone", () => {
    expect(networkShortName({ name: "Mainnet" })).toBe("Mainnet");
  });

  it("keeps the name rather than rendering nothing", () => {
    // A name that is only a parenthetical would otherwise trim to "" and the
    // island would show a blank where the chain should be.
    expect(networkShortName({ name: "(unnamed)" })).toBe("(unnamed)");
  });

  it("gives every built-in network its own colour", () => {
    // Each built-in network gets its own colour, so which chain you are on
    // is answerable at a glance. Two networks sharing one would defeat the
    // point.
    const colors = DEFAULT_NETWORKS.map((n) => n.color);
    expect(colors.every(Boolean)).toBe(true);
    expect(new Set(colors).size).toBe(DEFAULT_NETWORKS.length);
  });

  it("gives every built-in network a label with no qualifier", () => {
    for (const net of DEFAULT_NETWORKS) {
      expect(networkShortName(net)).not.toMatch(/[()]/);
    }
  });
});

describe("DEFAULT_NETWORKS", () => {
  it("defaults to the mainnet network with correct RPC, chain id, and trust", () => {
    expect(DEFAULT_NETWORK_ID).toBe("mainnet");
    const active = DEFAULT_NETWORKS.find((n) => n.id === DEFAULT_NETWORK_ID);
    expect(active).toMatchObject({
      chainId: "gnoland1",
      rpcUrl: "https://rpc.gno.land",
      environment: "mainnet",
      trust: "official",
      persistence: "persistent",
    });
  });

  it("leads the list with the default so the picker opens on it", () => {
    // The picker renders DEFAULT_NETWORKS in order. A default buried mid-list
    // would put the chain you are actually on below ones you are not.
    expect(DEFAULT_NETWORKS[0]?.id).toBe(DEFAULT_NETWORK_ID);
  });

  it("keeps pearl's endpoints intact now that it is no longer the default", () => {
    // Still a first-class selectable network — losing the default must not
    // mean losing the verified endpoints behind it.
    const pearl = DEFAULT_NETWORKS.find((n) => n.id === "pearl");
    expect(pearl).toMatchObject({
      chainId: "pearl-1",
      rpcUrl: "https://rpc.pearl.testnets.gno.land",
      indexerGraphqlUrl: "https://indexer.pearl.testnets.gno.land/graphql/query",
      environment: "testnet",
      trust: "official",
      persistence: "rolling",
    });
  });

  it("still includes mainnet, pearl, staging, and gnodev as selectable networks", () => {
    expect(DEFAULT_NETWORKS.map((n) => n.id)).toEqual(["mainnet", "pearl", "staging", "gnodev"]);
  });

  it("points staging at its confirmed live chain id and RPC, with no dead companion links", () => {
    // Staging has no indexer/gnockpit/explorer/status subdomain (unlike the
    // testnets), so those fields must be left unset rather than pointed at
    // hosts that don't resolve.
    const staging = DEFAULT_NETWORKS.find((n) => n.id === "staging");
    expect(staging).toMatchObject({
      chainId: "staging",
      rpcUrl: "https://rpc.staging.gno.land",
      gnowebUrl: "https://staging.gno.land",
      environment: "staging",
      trust: "official",
    });
    expect(staging?.indexerGraphqlUrl).toBeUndefined();
    expect(staging?.gnockpitUrl).toBeUndefined();
    expect(staging?.explorerUrl).toBeUndefined();
    expect(staging?.statusUrl).toBeUndefined();
  });

  it("points pearl's indexer at the query endpoint, not its playground", () => {
    // The endpoint the app was first pointed at served the GraphQL
    // playground as HTML — pointing the app there would have meant feeding
    // markup to a JSON parser. `/graphql/query` is the API.
    const pearl = DEFAULT_NETWORKS.find((n) => n.id === "pearl");
    expect(pearl?.indexerGraphqlUrl).toMatch(/\/graphql\/query$/);
  });

  it("points every indexer-backed network at the query endpoint, not the playground", () => {
    for (const net of DEFAULT_NETWORKS) {
      if (net.indexerGraphqlUrl) expect(net.indexerGraphqlUrl).toMatch(/\/graphql\/query$/);
    }
  });

  it("gives every indexer-backed network the capability that gates indexer reads", () => {
    for (const net of DEFAULT_NETWORKS) {
      if (net.indexerGraphqlUrl) expect(net.capabilities).toContain("indexer.read");
    }
  });

  it("gnodev points at gnodev's documented local defaults and doesn't override the default network", () => {
    expect(DEFAULT_NETWORK_ID).not.toBe("gnodev");
    const gnodev = DEFAULT_NETWORKS.find((n) => n.id === "gnodev");
    expect(gnodev).toMatchObject({
      chainId: "dev",
      rpcUrl: "http://127.0.0.1:26657",
      gnowebUrl: "http://127.0.0.1:8888",
      environment: "local",
    });
  });

  it("every network has a websocket URL derived from its RPC URL", () => {
    for (const net of DEFAULT_NETWORKS) {
      expect(net.websocketUrl).toBe(net.rpcUrl.replace(/^http/, "ws") + "/websocket");
    }
  });
});
