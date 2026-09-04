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

describe("the Browser home's list budget", () => {
  // HOME_PATH_MAX in realm-browser.tsx. Kept in step with it by hand; what is
  // actually guarded here is that the ALGORITHM still makes these particular
  // paths readable, since they are the real ones that motivated shortening the
  // home lists at all — measured off Pearl's "Recently deployed" panel, where
  // every row was a different 40-character address.
  const HOME_PATH_MAX = 44;

  it("keeps the identifying word visible on a user-deployed realm", () => {
    const real = "gno.land/r/g12cs4cehujpffpjpywmkqj43m6u5ya53nj69sjz/pixelcanvas";
    const result = smartTruncateRealmPath(real, HOME_PATH_MAX);
    expect(result).toBe("r/g…/pixelcanvas");
    expect(result.length).toBeLessThanOrEqual(HOME_PATH_MAX);
  });

  it("keeps a nested package's full name, not just its last segment", () => {
    // A path with more than three segments: everything after the namespace is
    // the package name, and truncating it to the tail would lose the parent
    // that distinguishes e.g. pointsv2 from some other realm's v2.
    const real = "gno.land/r/g1mv0052e7r6s09f5t9xsqf00nj3tqsgt9dg52jr/gnomemepad/pointsv2";
    expect(smartTruncateRealmPath(real, HOME_PATH_MAX)).toBe("r/g…/gnomemepad/pointsv2");
  });

  it("leaves the curated system realms completely alone", () => {
    // These already fit, and shortening them would be pure loss — they are
    // the paths people actually recognise.
    for (const path of [
      "gno.land/r/sys/users",
      "gno.land/r/gnoland/blog",
      "gno.land/r/gnoland/boards2/v1",
      "gno.land/p/demo/tokens/grc20",
    ]) {
      expect(smartTruncateRealmPath(path, HOME_PATH_MAX)).toBe(path.replace(/^gno\.land\//, ""));
    }
  });
});
