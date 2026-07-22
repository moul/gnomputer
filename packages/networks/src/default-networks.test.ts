import { describe, it, expect } from "vitest";
import { DEFAULT_NETWORKS, DEFAULT_NETWORK_ID } from "./default-networks";

describe("DEFAULT_NETWORKS", () => {
  it("includes the default test13 network with correct RPC and chain id", () => {
    const test13 = DEFAULT_NETWORKS.find((n) => n.id === DEFAULT_NETWORK_ID);
    expect(test13).toMatchObject({
      chainId: "test-13",
      rpcUrl: "https://rpc.test13.testnets.gno.land",
      environment: "testnet",
      trust: "official",
      persistence: "rolling",
    });
  });

  it("every network has a websocket URL derived from its RPC URL", () => {
    for (const net of DEFAULT_NETWORKS) {
      expect(net.websocketUrl).toBe(net.rpcUrl.replace(/^http/, "ws") + "/websocket");
    }
  });
});
