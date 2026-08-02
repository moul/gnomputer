import { describe, it, expect } from "vitest";
import { matchApps } from "./palette-apps";

describe("matchApps", () => {
  it("finds an app by name", () => {
    expect(matchApps("editor").map((a) => a.id)).toEqual(["editor"]);
  });

  it("is case-insensitive and matches a prefix", () => {
    expect(matchApps("SETT").map((a) => a.id)).toEqual(["settings"]);
  });

  it("ranks a prefix match above a substring one", () => {
    // "ed" is a prefix of Editor and appears inside Block Explorer. Ranking
    // by "contains" alone makes short queries feel random.
    const ids = matchApps("ed").map((a) => a.id);
    expect(ids[0]).toBe("editor");
  });

  it("finds apps that have no island icon", () => {
    // These are reachable only contextually today, so the palette is the
    // one place they can be found deliberately.
    expect(matchApps("governance").map((a) => a.id)).toEqual(["governance"]);
    expect(matchApps("tokens").map((a) => a.id)).toEqual(["tokens"]);
  });

  it("returns nothing for an empty or whitespace query", () => {
    expect(matchApps("")).toEqual([]);
    expect(matchApps("   ")).toEqual([]);
  });

  it("returns nothing for a query that is an address, not an app name", () => {
    expect(matchApps("g1manfred47kzduec920z88wfr64ylksmdcedlf5")).toEqual([]);
  });

  it("bounds the result count", () => {
    // A single letter matches a lot; the palette should not become a wall.
    expect(matchApps("e").length).toBeLessThanOrEqual(6);
  });
});
