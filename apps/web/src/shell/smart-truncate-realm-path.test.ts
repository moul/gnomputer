import { describe, it, expect } from "vitest";
import { smartTruncateRealmPath } from "./smart-truncate-realm-path";

describe("smartTruncateRealmPath", () => {
  it("strips the leading domain and returns the rest unchanged when it already fits", () => {
    expect(smartTruncateRealmPath("gno.land/r/demo/foo")).toBe("r/demo/foo");
  });

  it("truncates a long namespace to its first letter + ellipsis before touching the package name", () => {
    const result = smartTruncateRealmPath("gno.land/r/g12cs4cehujpffpjpywmkqj43m6u5ya53nj69sjz/markov", 28);
    expect(result).toBe("r/g…/markov");
    expect(result.endsWith("/markov")).toBe(true);
  });

  it("only middle-truncates the package name once the shortened namespace still doesn't fit", () => {
    const longPackageName = "really-long-package-name-that-does-not-fit";
    const result = smartTruncateRealmPath(`gno.land/r/${"x".repeat(30)}/${longPackageName}`, 24);
    expect(result.startsWith("r/x…/")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(24);
    expect(result).toContain("…");
    expect(result).not.toContain(longPackageName);
  });

  it("falls back to plain middle-truncation when there's no kind/namespace/package structure", () => {
    const bare = "x".repeat(40);
    const result = smartTruncateRealmPath(bare, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).toContain("…");
  });

  it("leaves a short namespace (already 1 character) alone rather than adding a pointless ellipsis", () => {
    const result = smartTruncateRealmPath(`gno.land/r/g/${"y".repeat(30)}`, 20);
    expect(result.startsWith("r/g/")).toBe(true);
  });

  it("handles a multi-segment package name (subpath after the realm's own name)", () => {
    const result = smartTruncateRealmPath("gno.land/r/gnoswap/gov/staker/v1", 15);
    expect(result.length).toBeLessThanOrEqual(15);
  });
});
