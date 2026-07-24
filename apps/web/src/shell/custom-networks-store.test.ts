import { describe, it, expect } from "vitest";
import { buildCustomNetworkConfig } from "./custom-networks-store";

describe("buildCustomNetworkConfig", () => {
  it("builds a full NetworkConfig from a name and RPC URL", () => {
    const config = buildCustomNetworkConfig("My Local Node", "http://127.0.0.1:26657");
    expect(config).toMatchObject({
      name: "My Local Node",
      rpcUrl: "http://127.0.0.1:26657",
      environment: "custom",
      persistence: "unknown",
      trust: "custom",
      capabilities: [],
    });
    expect(config.id).toBe("custom-my-local-node");
  });

  it("slugifies the name into a stable id, so re-adding the same name reuses it", () => {
    const a = buildCustomNetworkConfig("Gno Dev!!", "http://localhost:1");
    const b = buildCustomNetworkConfig("gno dev", "http://localhost:2");
    expect(a.id).toBe("custom-gno-dev");
    expect(b.id).toBe("custom-gno-dev");
  });

  it("trims surrounding whitespace from the name", () => {
    const config = buildCustomNetworkConfig("  Spacey  ", "http://localhost:1");
    expect(config.name).toBe("Spacey");
  });
});
