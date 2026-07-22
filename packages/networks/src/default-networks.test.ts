import { describe, it, expect } from "vitest";
import { DEFAULT_NETWORKS, DEFAULT_NETWORK_ID } from "./default-networks";

describe("DEFAULT_NETWORKS", () => {
  it("defaults to the topaz network with correct RPC, chain id, and indexer", () => {
    expect(DEFAULT_NETWORK_ID).toBe("topaz");
    const topaz = DEFAULT_NETWORKS.find((n) => n.id === DEFAULT_NETWORK_ID);
    expect(topaz).toMatchObject({
      chainId: "topaz-1",
      rpcUrl: "https://rpc.topaz.testnets.gno.land",
      indexerGraphqlUrl: "https://indexer.topaz.testnets.gno.land/graphql/query",
      environment: "testnet",
      trust: "official",
      persistence: "rolling",
    });
  });

  it("still includes test13 and betanet as selectable networks", () => {
    expect(DEFAULT_NETWORKS.map((n) => n.id)).toEqual(
      expect.arrayContaining(["topaz", "test13", "betanet"])
    );
  });

  it("every network has a websocket URL derived from its RPC URL", () => {
    for (const net of DEFAULT_NETWORKS) {
      expect(net.websocketUrl).toBe(net.rpcUrl.replace(/^http/, "ws") + "/websocket");
    }
  });
});
