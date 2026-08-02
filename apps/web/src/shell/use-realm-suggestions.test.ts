import { describe, expect, it } from "vitest";
import { combineSuggestions, packagePrefixFromQuery } from "./use-realm-suggestions";

describe("packagePrefixFromQuery", () => {
  it("passes a fully-qualified path straight through", () => {
    expect(packagePrefixFromQuery("gno.land/r/gov")).toBe("gno.land/r/gov");
  });

  it("expands the r/ and p/ shorthand the rest of the app accepts", () => {
    // vm/qpaths only matches real deployed paths, which always carry the
    // domain. Without this, typing "r/gov" queried the chain for a prefix
    // no package has ever had.
    expect(packagePrefixFromQuery("r/gov/dao")).toBe("gno.land/r/gov/dao");
    expect(packagePrefixFromQuery("p/nt/ufmt")).toBe("gno.land/p/nt/ufmt");
  });

  it("trims before deciding", () => {
    expect(packagePrefixFromQuery("  r/gov  ")).toBe("gno.land/r/gov");
  });

  it("returns null for anything not yet path-shaped", () => {
    // The RPC prefix search is the expensive source; it should not fire on
    // a bare word, an address, or an empty box. The cheaper substring
    // sources still answer those.
    expect(packagePrefixFromQuery("")).toBeNull();
    expect(packagePrefixFromQuery("   ")).toBeNull();
    expect(packagePrefixFromQuery("gov")).toBeNull();
    expect(packagePrefixFromQuery("g1manfred47kzduec920z88wfr64ylksmdcedlf5")).toBeNull();
  });

  it("does not treat a path that merely contains r/ as shorthand", () => {
    expect(packagePrefixFromQuery("foo/r/bar")).toBeNull();
  });
});

describe("combineSuggestions", () => {
  const empty = {
    rpcMatches: [],
    allPackageMatches: [],
    indexerMatches: [],
    knownRealms: [],
    activityPaths: [],
  };

  it("keeps the source precedence: rpc, all-packages, indexer, curated, activity", () => {
    const out = combineSuggestions({
      rpcMatches: ["a"],
      allPackageMatches: ["b"],
      indexerMatches: ["c"],
      knownRealms: [{ label: "Curated", packagePath: "d" }],
      activityPaths: ["e"],
    });
    expect(out.map((s) => s.packagePath)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("lists a path once, however many sources produced it", () => {
    const out = combineSuggestions({
      ...empty,
      rpcMatches: ["gno.land/r/gov/dao"],
      allPackageMatches: ["gno.land/r/gov/dao"],
      indexerMatches: ["gno.land/r/gov/dao"],
      activityPaths: ["gno.land/r/gov/dao"],
    });
    expect(out).toHaveLength(1);
  });

  it("labels a curated realm with its name, and everything else with its path", () => {
    const out = combineSuggestions({
      ...empty,
      rpcMatches: ["gno.land/r/demo/boards"],
      knownRealms: [{ label: "GovDAO", packagePath: "gno.land/r/gov/dao" }],
    });
    expect(out).toEqual([
      { label: "gno.land/r/demo/boards", packagePath: "gno.land/r/demo/boards" },
      { label: "GovDAO", packagePath: "gno.land/r/gov/dao" },
    ]);
  });

  it("gives a live RPC hit the path label even when it is also curated", () => {
    // First mention wins, and the chain's own answer comes first. The
    // curated label is a nicety; the path is what the chain knows.
    const out = combineSuggestions({
      ...empty,
      rpcMatches: ["gno.land/r/gov/dao"],
      knownRealms: [{ label: "GovDAO", packagePath: "gno.land/r/gov/dao" }],
    });
    expect(out).toEqual([{ label: "gno.land/r/gov/dao", packagePath: "gno.land/r/gov/dao" }]);
  });

  it("is empty when every source is", () => {
    expect(combineSuggestions(empty)).toEqual([]);
  });

  it("still offers the curated realms before anything has been typed", () => {
    // The dropdown has to be useful on focus, not only after a query — (4)
    // and (5) need no round-trip for exactly that reason.
    const out = combineSuggestions({
      ...empty,
      knownRealms: [{ label: "GovDAO", packagePath: "gno.land/r/gov/dao" }],
      activityPaths: ["gno.land/r/busy/one"],
    });
    expect(out.map((s) => s.packagePath)).toEqual(["gno.land/r/gov/dao", "gno.land/r/busy/one"]);
  });
});
