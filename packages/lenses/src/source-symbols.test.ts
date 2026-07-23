import { describe, it, expect } from "vitest";
import { parseImports, isChainPackage, parseExportedSymbols } from "./source-symbols";

// Real source captured live from gno.land/r/gnoland/blog/gnoblog.gno on Topaz
// (vm/qfile), 2026-07-23 — not a synthetic fixture.
const GNOBLOG_GNO = `package blog

import (
	"chain/runtime/unsafe"

	"gno.land/p/demo/blog"
)

var b = &blog.Blog{
	Title:  "Gno.land's blog",
	Prefix: "/r/gnoland/blog:",
}

func AddComment(_ realm, postSlug, comment string) {
	assertIsCommenter()
	assertNotInPause()

	caller := unsafe.OriginCaller()
	err := b.GetPost(postSlug).AddComment(caller, comment)
	checkErr(err)
}

func Render(path string) string {
	return b.Render(path)
}

func RenderLastPostsWidget(limit int) string {
	return b.RenderLastPostsWidget(limit)
}

func PostExists(slug string) bool {
	if b.GetPost(slug) == nil {
		return false
	}
	return true
}
`;

describe("parseImports", () => {
  it("parses a grouped import block", () => {
    const imports = parseImports(GNOBLOG_GNO);
    expect(imports).toEqual([
      { path: "chain/runtime/unsafe", alias: undefined },
      { path: "gno.land/p/demo/blog", alias: undefined },
    ]);
  });

  it("parses a single-line import", () => {
    expect(parseImports('package foo\n\nimport "strings"\n')).toEqual([
      { path: "strings", alias: undefined },
    ]);
  });

  it("captures an import alias", () => {
    expect(parseImports('import (\n\tbp "gno.land/p/nt/bptree/v0"\n)')).toEqual([
      { path: "gno.land/p/nt/bptree/v0", alias: "bp" },
    ]);
  });

  it("returns an empty list when there are no imports", () => {
    expect(parseImports("package foo\n\nfunc F() {}\n")).toEqual([]);
  });
});

describe("isChainPackage", () => {
  it("treats gno.land/p and gno.land/r paths as on-chain packages", () => {
    expect(isChainPackage("gno.land/p/demo/blog")).toBe(true);
    expect(isChainPackage("gno.land/r/gov/dao")).toBe(true);
  });

  it("treats everything else as a stdlib", () => {
    expect(isChainPackage("chain/runtime/unsafe")).toBe(false);
    expect(isChainPackage("strings")).toBe(false);
    expect(isChainPackage("errors")).toBe(false);
  });
});

describe("parseExportedSymbols", () => {
  const symbols = parseExportedSymbols("gnoblog.gno", GNOBLOG_GNO);

  it("finds all four exported functions", () => {
    expect(symbols.map((s) => s.name)).toEqual([
      "AddComment",
      "Render",
      "RenderLastPostsWidget",
      "PostExists",
    ]);
  });

  it("flags a function with a leading realm param as a realm action", () => {
    const addComment = symbols.find((s) => s.name === "AddComment")!;
    expect(addComment.isRealmAction).toBe(true);
    expect(addComment.signature).toBe("func AddComment(_ realm, postSlug, comment string)");
  });

  it("does not flag a plain query function as a realm action", () => {
    const render = symbols.find((s) => s.name === "Render")!;
    expect(render.isRealmAction).toBe(false);
    expect(render.doc).toEqual([]);
  });

  it("does not pick up unexported or nested identifiers", () => {
    expect(symbols.some((s) => s.name === "b")).toBe(false);
  });

  it("attaches a doc comment immediately preceding a declaration", () => {
    const withDoc = parseExportedSymbols(
      "x.gno",
      "package x\n\n// Frobnicate does the thing.\n// It never fails.\nfunc Frobnicate() {}\n"
    );
    expect(withDoc[0]!.doc).toEqual(["Frobnicate does the thing.", "It never fails."]);
  });

  it("does not attach a doc comment separated by a blank line", () => {
    const noDoc = parseExportedSymbols(
      "x.gno",
      "package x\n\n// Unrelated comment.\n\nfunc Frobnicate() {}\n"
    );
    expect(noDoc[0]!.doc).toEqual([]);
  });

  it("parses an exported type declaration", () => {
    const types = parseExportedSymbols("x.gno", "package x\n\ntype Blog struct {\n\tTitle string\n}\n");
    expect(types).toEqual([
      {
        kind: "type",
        name: "Blog",
        signature: "type Blog struct",
        doc: [],
        isRealmAction: false,
        file: "x.gno",
      },
    ]);
  });
});
