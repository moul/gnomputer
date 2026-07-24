import { describe, it, expect } from "vitest";
import { buildDocTree } from "./doc-tree";

describe("buildDocTree", () => {
  it("nests files under their folders, stripping the given prefix", () => {
    const tree = buildDocTree(
      ["docs/adr/ADR-001-x.md", "docs/adr/ADR-002-y.md", "docs/product/spec.md"],
      "docs/"
    );
    expect(tree.map((n) => n.name)).toEqual(["adr", "product"]);
    expect(tree[0]!.type).toBe("folder");
    expect(tree[0]!.children!.map((n) => n.name)).toEqual(["ADR-001-x.md", "ADR-002-y.md"]);
    expect(tree[0]!.children![0]!.path).toBe("docs/adr/ADR-001-x.md");
  });

  it("supports arbitrary depth", () => {
    const tree = buildDocTree(["docs/superpowers/plans/2026-07-22-x.md"], "docs/");
    expect(tree[0]!.name).toBe("superpowers");
    expect(tree[0]!.children![0]!.name).toBe("plans");
    expect(tree[0]!.children![0]!.children![0]!.name).toBe("2026-07-22-x.md");
    expect(tree[0]!.children![0]!.children![0]!.type).toBe("file");
  });

  it("ignores paths outside the stripped prefix", () => {
    const tree = buildDocTree(["src/index.ts", "docs/a.md"], "docs/");
    expect(tree.map((n) => n.name)).toEqual(["a.md"]);
  });

  it("sorts folders before files, alphabetically within each group", () => {
    const tree = buildDocTree(["docs/z.md", "docs/a.md", "docs/nested/x.md"], "docs/");
    expect(tree.map((n) => n.name)).toEqual(["nested", "a.md", "z.md"]);
  });
});
