import { describe, it, expect } from "vitest";
import { parseUserData } from "./user-data";

// Both raw strings captured live from gno.land/r/sys/users on Topaz via
// vm/qeval (ResolveAny), 2026-07-24 — not synthetic fixtures.
const FOUND_RAW = `(&(struct{("g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5" .uverse.address),("test1" string),(false bool)} gno.land/r/sys/users.UserData) *gno.land/r/sys/users.UserData)
(true bool)`;

const NOT_FOUND_RAW = `(nil *gno.land/r/sys/users.UserData)
(false bool)`;

describe("parseUserData", () => {
  it("parses a found user's address and username", () => {
    expect(parseUserData(FOUND_RAW)).toEqual({
      address: "g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5",
      username: "test1",
      found: true,
    });
  });

  it("reports not found for a nil result", () => {
    expect(parseUserData(NOT_FOUND_RAW)).toEqual({ address: null, username: null, found: false });
  });
});
