import { describe, it, expect } from "vitest";
import { DEFAULT_NETWORKS, DEFAULT_NETWORK_ID } from "./default-networks";

describe("DEFAULT_NETWORKS", () => {
  it("defaults to the sapphire network with correct RPC, chain id, and indexer", () => {
    expect(DEFAULT_NETWORK_ID).toBe("sapphire");
    const active = DEFAULT_NETWORKS.find((n) => n.id === DEFAULT_NETWORK_ID);
    expect(active).toMatchObject({
      chainId: "sapphire-1",
      rpcUrl: "https://rpc.sapphire.testnets.gno.land",
      indexerGraphqlUrl: "https://indexer.sapphire.testnets.gno.land/graphql/query",
      environment: "testnet",
      trust: "official",
      persistence: "rolling",
    });
  });

  it("keeps topaz's endpoints intact now that it is no longer the default", () => {
    // Still a first-class selectable network — losing the default must not
    // mean losing the verified endpoints behind it.
    const topaz = DEFAULT_NETWORKS.find((n) => n.id === "topaz");
    expect(topaz).toMatchObject({
      chainId: "topaz-1",
      rpcUrl: "https://rpc.topaz.testnets.gno.land",
      indexerGraphqlUrl: "https://indexer.topaz.testnets.gno.land/graphql/query",
      environment: "testnet",
      trust: "official",
      persistence: "rolling",
    });
  });

  it("still includes betanet and gnodev as selectable networks", () => {
    expect(DEFAULT_NETWORKS.map((n) => n.id)).toEqual(
      expect.arrayContaining(["topaz", "sapphire", "betanet", "gnodev"])
    );
  });

  it("points sapphire at the indexer's query endpoint, not its playground", () => {
    // The endpoint announced for Sapphire was `/graphql`, which serves the
    // GraphQL playground as HTML — pointing the app there would have meant
    // feeding markup to a JSON parser. `/graphql/query` is the API, and is
    // the same convention Topaz already uses.
    const sapphire = DEFAULT_NETWORKS.find((n) => n.id === "sapphire");
    expect(sapphire).toMatchObject({
      chainId: "sapphire-1",
      rpcUrl: "https://rpc.sapphire.testnets.gno.land",
      indexerGraphqlUrl: "https://indexer.sapphire.testnets.gno.land/graphql/query",
      environment: "testnet",
      trust: "official",
    });
    expect(sapphire?.indexerGraphqlUrl).toMatch(/\/graphql\/query$/);
  });

  it("defaults to a network that is both official and indexer-backed", () => {
    // #199 held this at topaz so that *adding* sapphire would not move anyone
    // mid-session; the move is now deliberate. What must not change is the
    // kind of network a first visit lands on: an official testnet with an
    // indexer, since Browser home and the Block Explorer are empty without
    // one, and trust is what the provenance UI reports.
    const active = DEFAULT_NETWORKS.find((n) => n.id === DEFAULT_NETWORK_ID);
    expect(active?.trust).toBe("official");
    expect(active?.environment).toBe("testnet");
    expect(active?.indexerGraphqlUrl).toBeTruthy();
    expect(active?.capabilities).toContain("indexer.read");
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
