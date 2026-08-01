import { describe, it, expect } from "vitest";
import { matchEntityAt, matchWholeEntity } from "./entity-patterns";

// A real Topaz address. It has to be real now: the address branch verifies
// the bech32 checksum, so `g1` + 30 arbitrary characters — what this used to
// be — is correctly no longer recognised as an address.
const ADDRESS = "g1manfred47kzduec920z88wfr64ylksmdcedlf5";

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

describe("bech32 verification", () => {
  it("ignores a shape-valid address whose checksum is wrong", () => {
    // The regex still matches this — it is "g1" followed by lowercase
    // alphanumerics of a plausible length. Only the checksum tells them
    // apart, and without it a typo becomes a link to an account that
    // cannot exist (AUD-031).
    const flipped = `${ADDRESS.slice(0, -1)}4`;
    expect(flipped).toMatch(/^g1[a-z0-9]{25,50}$/);
    expect(matchWholeEntity(flipped)).toBeNull();
    expect(matchEntityAt(`see ${flipped} for details`)).toBeNull();
  });

  it("still finds a later valid entity when an earlier candidate fails the checksum", () => {
    const flipped = `${ADDRESS.slice(0, -1)}4`;
    expect(matchEntityAt(`${flipped} and @moul`)).toEqual({ kind: "username", text: "@moul" });
  });
});
