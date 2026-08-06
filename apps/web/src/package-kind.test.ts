import { describe, it, expect } from "vitest";
import { packageKind } from "./package-kind";

describe("packageKind", () => {
  it("classifies real deployed paths", () => {
    // Both taken from Topaz's own vm/qpaths listing.
    expect(packageKind("gno.land/r/gov/dao")).toBe("realm");
    expect(packageKind("gno.land/p/aib/encoding")).toBe("library");
  });

  it("reads the kind segment, not a substring anywhere in the path", () => {
    // A realm is free to have a package named "p" somewhere below it;
    // `.includes("/p/")` would file this under libraries.
    expect(packageKind("gno.land/r/demo/p/nested")).toBe("realm");
    expect(packageKind("gno.land/p/demo/r/nested")).toBe("library");
  });

  it("does not guess at anything that is neither", () => {
    expect(packageKind("gno.land/x/experimental")).toBe("other");
    expect(packageKind("gno.land")).toBe("other");
    expect(packageKind("")).toBe("other");
  });
});
