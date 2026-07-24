import { describe, it, expect } from "vitest";
import { addressFromRefUri } from "./users";

describe("addressFromRefUri", () => {
  it("extracts the address from an address-kind ref URI", () => {
    expect(addressFromRefUri("gno://topaz/address/g1abc")).toBe("g1abc");
  });

  it("returns null for a non-address ref URI", () => {
    expect(addressFromRefUri("gno://topaz/realm/gno.land/r/demo/foo")).toBeNull();
    expect(addressFromRefUri("gno://topaz/block/12345")).toBeNull();
  });

  it("returns null for a malformed URI", () => {
    expect(addressFromRefUri("not-a-uri")).toBeNull();
  });
});
