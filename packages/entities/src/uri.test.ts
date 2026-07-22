import { describe, it, expect } from "vitest";
import { parseGnoUri, formatGnoUri } from "./uri";

describe("parseGnoUri", () => {
  it("parses a realm URI", () => {
    const ref = parseGnoUri("gno://test13/realm/gno.land/r/gov/dao");
    expect(ref).toMatchObject({
      kind: "realm",
      networkId: "test13",
      packagePath: "gno.land/r/gov/dao",
    });
  });

  it("parses a function URI with a fragment", () => {
    const ref = parseGnoUri("gno://test13/function/gno.land/r/gov/dao#Vote");
    expect(ref).toMatchObject({
      kind: "function",
      networkId: "test13",
      packagePath: "gno.land/r/gov/dao",
      functionName: "Vote",
    });
  });

  it("parses an address URI", () => {
    const ref = parseGnoUri("gno://test13/address/g1abc123");
    expect(ref).toMatchObject({
      kind: "address",
      networkId: "test13",
      objectId: "g1abc123",
    });
  });

  it("parses a transaction URI", () => {
    const ref = parseGnoUri("gno://test13/tx/ABC123");
    expect(ref).toMatchObject({
      kind: "transaction",
      networkId: "test13",
      objectId: "ABC123",
    });
  });

  it("throws on an unknown scheme", () => {
    expect(() => parseGnoUri("https://example.com")).toThrow(/scheme/i);
  });

  it("round-trips through formatGnoUri", () => {
    const uri = formatGnoUri({
      networkId: "test13",
      kind: "realm",
      packagePath: "gno.land/r/gov/dao",
    });
    expect(uri).toBe("gno://test13/realm/gno.land/r/gov/dao");
    expect(parseGnoUri(uri).packagePath).toBe("gno.land/r/gov/dao");
  });
});
