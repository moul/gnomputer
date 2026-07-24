import { describe, it, expect } from "vitest";
import { matchEntityAt, matchWholeEntity } from "./entity-patterns";

const ADDRESS = `g1${"a".repeat(30)}`;

describe("matchEntityAt", () => {
  it("finds an address anywhere within surrounding prose", () => {
    const match = matchEntityAt(`sent to ${ADDRESS} yesterday`);
    expect(match).toEqual({ kind: "address", text: ADDRESS });
  });

  it("finds a username", () => {
    expect(matchEntityAt("ping @moul about this")).toEqual({ kind: "username", text: "@moul" });
  });

  it("finds an inline block reference", () => {
    expect(matchEntityAt("see #12345 for details")).toEqual({ kind: "block", text: "#12345" });
  });

  it("finds a realm path with a domain prefix", () => {
    expect(matchEntityAt("check gno.land/r/demo/foo now")).toEqual({
      kind: "realm",
      text: "gno.land/r/demo/foo",
    });
  });

  it("finds a bare realm path without a domain prefix", () => {
    expect(matchEntityAt("open r/gov/dao please")).toEqual({ kind: "realm", text: "r/gov/dao" });
  });

  it("returns null when nothing matches", () => {
    expect(matchEntityAt("just plain text, nothing to see here")).toBeNull();
  });

  it("returns the first match when multiple entities are present", () => {
    expect(matchEntityAt(`${ADDRESS} and also @moul`)).toEqual({ kind: "address", text: ADDRESS });
  });

  it("does not match an address that's too short to be real", () => {
    expect(matchEntityAt("g1tooshort")).toBeNull();
  });
});

describe("matchWholeEntity", () => {
  it("treats a bare digit string as a block height, prefixing #", () => {
    expect(matchWholeEntity("126553")).toEqual({ kind: "block", text: "#126553" });
  });

  it("treats a bare digit string with surrounding whitespace the same way", () => {
    expect(matchWholeEntity("  126553  ")).toEqual({ kind: "block", text: "#126553" });
  });

  it("matches a whole address string", () => {
    expect(matchWholeEntity(ADDRESS)).toEqual({ kind: "address", text: ADDRESS });
  });

  it("matches a whole username string", () => {
    expect(matchWholeEntity("@moul")).toEqual({ kind: "username", text: "@moul" });
  });

  it("matches a whole realm path string", () => {
    expect(matchWholeEntity("gno.land/r/demo/foo")).toEqual({
      kind: "realm",
      text: "gno.land/r/demo/foo",
    });
  });

  it("returns null for an empty or whitespace-only string", () => {
    expect(matchWholeEntity("")).toBeNull();
    expect(matchWholeEntity("   ")).toBeNull();
  });

  it("returns null when the string isn't ENTIRELY an entity (extra trailing text)", () => {
    expect(matchWholeEntity(`${ADDRESS} plus more`)).toBeNull();
  });

  it("returns null for a string matching none of the known shapes", () => {
    expect(matchWholeEntity("not-an-entity")).toBeNull();
  });
});
