import { describe, it, expect } from "vitest";
import { RETIRED_KEYS } from "./use-retire-orphaned-state";

describe("RETIRED_KEYS", () => {
  it("names the pre-scoping keys that nothing reads any more", () => {
    expect(RETIRED_KEYS).toContain("realm-tabs");
    expect(RETIRED_KEYS).toContain("window-layout:home:v10");
  });

  it("cannot match a key that is still live", () => {
    // The live keys carry a network id. Retiring by prefix would eat them,
    // since `window-layout:home:v10:sapphire` starts with the retired
    // `window-layout:home:v10` — which is why the list is matched exactly.
    const live = [
      "realm-tabs:sapphire",
      "window-layout:home:v10:sapphire",
      "window-layout:home:v10:betanet",
      "theme",
      "active-network",
    ];
    for (const key of live) {
      expect(RETIRED_KEYS).not.toContain(key);
    }
  });

  it("does not retire anything still written by the app", () => {
    // A retired key that something still sets would be deleted on every load
    // and rewritten immediately — churn that looks like corruption.
    expect(RETIRED_KEYS).not.toContain("active-network");
    expect(RETIRED_KEYS).not.toContain("custom-networks");
    expect(RETIRED_KEYS).not.toContain("theme");
  });
});
