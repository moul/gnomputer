import { describe, it, expect } from "vitest";
import { decodeBech32, isValidGnoAddress } from "./bech32";

// A real Topaz address, taken from a live r/sys/users.ResolveAny response.
const REAL = "g1manfred47kzduec920z88wfr64ylksmdcedlf5";

describe("decodeBech32", () => {
  it("decodes a real Gno address to a 20-byte payload under the g HRP", () => {
    expect(decodeBech32(REAL)).toMatchObject({ hrp: "g" });
    expect(decodeBech32(REAL)!.bytes).toHaveLength(20);
  });

  it("accepts the BIP-173 valid vectors", () => {
    expect(decodeBech32("A12UEL5L")).not.toBeNull();
    expect(decodeBech32("a12uel5l")).not.toBeNull();
    expect(decodeBech32("abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw")).not.toBeNull();
  });

  it("rejects the BIP-173 invalid vectors", () => {
    expect(decodeBech32("A1G7SGD8")).toBeNull(); // bad checksum
    expect(decodeBech32("pzry9x0s0muk")).toBeNull(); // no separator
    expect(decodeBech32("1pzry9x0s0muk")).toBeNull(); // empty HRP
    expect(decodeBech32("x1b4n0q5v")).toBeNull(); // invalid data character
    expect(decodeBech32("li1dgmt3")).toBeNull(); // too short a data part
  });

  it("rejects mixed case, which would make the checksum ambiguous", () => {
    expect(decodeBech32("A12UeL5L")).toBeNull();
  });
});

describe("isValidGnoAddress", () => {
  it("accepts a real address, with or without surrounding whitespace", () => {
    expect(isValidGnoAddress(REAL)).toBe(true);
    expect(isValidGnoAddress(`  ${REAL}  `)).toBe(true);
  });

  it("rejects an address with a single flipped character", () => {
    // This is the whole point. The old regex, /^g1[a-z0-9]{25,50}$/, accepts
    // this: it is still "g1" followed by lowercase alphanumerics of the
    // right length. The app would then query the chain for an account that
    // cannot exist and report it as simply not found.
    const flipped = `${REAL.slice(0, -1)}4`;
    expect(flipped).toMatch(/^g1[a-z0-9]{25,50}$/);
    expect(isValidGnoAddress(flipped)).toBe(false);
  });

  it("rejects a truncated address", () => {
    const truncated = REAL.slice(0, -1);
    expect(truncated).toMatch(/^g1[a-z0-9]{25,50}$/);
    expect(isValidGnoAddress(truncated)).toBe(false);
  });

  it("rejects an address for another chain even when the checksum is valid", () => {
    // Correct bech32, wrong human-readable part. Length-and-shape matching
    // has no way to tell these apart from a Gno address.
    expect(decodeBech32("cosmos1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu")).not.toBeNull();
    expect(isValidGnoAddress("cosmos1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu")).toBe(false);
  });

  it("rejects the obvious non-addresses", () => {
    expect(isValidGnoAddress("")).toBe(false);
    expect(isValidGnoAddress("g1")).toBe(false);
    expect(isValidGnoAddress("moul")).toBe(false);
    expect(isValidGnoAddress("gno.land/r/demo/boards")).toBe(false);
  });
});
