import { describe, it, expect } from "vitest";
import { findImportPaths } from "./find-import-paths";

describe("findImportPaths", () => {
  it("finds a single-line import", () => {
    const doc = 'package foo\n\nimport "gno.land/p/demo/avl"\n';
    const matches = findImportPaths(doc);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.path).toBe("gno.land/p/demo/avl");
    expect(doc.slice(matches[0]!.from, matches[0]!.to)).toBe("gno.land/p/demo/avl");
  });

  it("finds every import inside a grouped import block", () => {
    const doc = [
      "package foo",
      "",
      "import (",
      '\t"gno.land/p/demo/avl"',
      '\t"gno.land/r/gnoland/blog"',
      ")",
    ].join("\n");
    const matches = findImportPaths(doc);
    expect(matches.map((m) => m.path)).toEqual(["gno.land/p/demo/avl", "gno.land/r/gnoland/blog"]);
  });

  it("ignores a string literal outside of any import statement", () => {
    const doc = 'package foo\n\nvar x = "gno.land/r/not/an/import"\n';
    expect(findImportPaths(doc)).toEqual([]);
  });

  it("ignores a plain (non-r/p) import like a standard library package", () => {
    const doc = 'import (\n\t"std"\n\t"strings"\n\t"gno.land/p/demo/avl"\n)';
    const matches = findImportPaths(doc);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.path).toBe("gno.land/p/demo/avl");
  });

  it("returns no matches for a file with no imports at all", () => {
    expect(findImportPaths("package foo\n\nfunc main() {}\n")).toEqual([]);
  });
});
