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

describe("aliases", () => {
  it("finds Block Explorer by the name the island's Chain menu uses", () => {
    // island-chain-menu.tsx labels it "Blocks"; this registry says "Block
    // Explorer". Typing the word you just read in the menu matched nothing.
    expect(matchApps("blocks").map((a) => a.id)).toContain("block-explorer");
  });

  it("answers to the obvious near-misses", () => {
    for (const [query, id] of [
      ["repl", "shell"],
      ["terminal", "shell"],
      ["wallet", "address"],
      ["txs", "transactions"],
      ["validators", "validator-monitor"],
      ["govdao", "governance"],
      ["trail", "history"],
      ["gas", "chain-stats"],
      ["rpc", "network-monitor"],
      ["preferences", "settings"],
    ] as const) {
      expect(matchApps(query).map((a) => a.id), `"${query}" should find ${id}`).toContain(id);
    }
  });

  it("never lets an alias outrank an app typed by its real name", () => {
    // "status" is an alias of Network Monitor. Nothing is literally named
    // "status", but the rule has to hold in general: a label hit wins.
    const forEditor = matchApps("editor");
    expect(forEditor[0]!.id).toBe("editor");
    // "events" is an alias of Event Explorer, whose label also contains it —
    // the label match is what should be doing the work.
    expect(matchApps("event")[0]!.id).toBe("event-explorer");
  });

  it("still finds nothing for a word no app claims", () => {
    expect(matchApps("zzzznope")).toEqual([]);
  });
});
