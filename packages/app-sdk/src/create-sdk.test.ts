import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { createGnomputerSDK } from "./create-sdk";

describe("createGnomputerSDK", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase("gnomputer-sdk-test");
  });

  it("defaults to the test13 network", () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    expect(sdk.networks.getActive().id).toBe("test13");
  });

  it("switches active network", () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    sdk.networks.setActive("betanet");
    expect(sdk.networks.getActive().id).toBe("betanet");
  });

  it("starts a Trail and records a step through the SDK", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    const trailId = await sdk.trails.start("Untitled Trail");
    await sdk.trails.addStep(trailId, "gno://test13/realm/gno.land/r/demo/foo", "Foo");
    const steps = await sdk.trails.getSteps(trailId);
    expect(steps).toHaveLength(1);
  });

  it("toggles a favorite", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    await sdk.favorites.toggle("gno://test13/realm/gno.land/r/demo/foo", "Foo");
    expect(await sdk.favorites.list()).toHaveLength(1);
    await sdk.favorites.toggle("gno://test13/realm/gno.land/r/demo/foo", "Foo");
    expect(await sdk.favorites.list()).toHaveLength(0);
  });

  it("persists and restores arbitrary UI state by key", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    expect(await sdk.uiState.get("window-layout:home")).toBeNull();
    await sdk.uiState.set("window-layout:home", '{"realm":{"x":10}}');
    expect(await sdk.uiState.get("window-layout:home")).toBe('{"realm":{"x":10}}');
  });

  it("does not let uiState collide with the internal Trail active-id key", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    await sdk.uiState.set("activeTrailId", "not-a-real-trail-id");
    const trailId = await sdk.trails.start("Untitled Trail");
    expect(await sdk.trails.getActiveTrailId()).toBe(trailId);
  });
});
