import { describe, it, expect } from "vitest";
import { flattenTree, treeKeyAction, type VisibleTreeNode } from "./tree-keys";
import type { DocTreeNode } from "./doc-tree";

const nodes: DocTreeNode[] = [
  {
    name: "adr",
    path: "docs/adr",
    type: "folder",
    children: [
      { name: "ADR-001.md", path: "docs/adr/ADR-001.md", type: "file" },
      { name: "ADR-002.md", path: "docs/adr/ADR-002.md", type: "file" },
    ],
  },
  { name: "readme.md", path: "docs/readme.md", type: "file" },
];

describe("flattenTree", () => {
  it("hides the children of a collapsed folder", () => {
    expect(flattenTree(nodes, new Set()).map((n) => n.path)).toEqual([
      "docs/adr",
      "docs/readme.md",
    ]);
  });

  it("includes children in order once the folder is open", () => {
    const visible = flattenTree(nodes, new Set(["docs/adr"]));
    expect(visible.map((n) => n.path)).toEqual([
      "docs/adr",
      "docs/adr/ADR-001.md",
      "docs/adr/ADR-002.md",
      "docs/readme.md",
    ]);
  });

  it("reports 1-based levels and parents, which aria-level and Left need", () => {
    const visible = flattenTree(nodes, new Set(["docs/adr"]));
    expect(visible[0]).toMatchObject({ level: 1, parentPath: null, expanded: true });
    expect(visible[1]).toMatchObject({ level: 2, parentPath: "docs/adr" });
  });
});

const open: VisibleTreeNode[] = flattenTree(nodes, new Set(["docs/adr"]));
const closed: VisibleTreeNode[] = flattenTree(nodes, new Set());

describe("treeKeyAction", () => {
  it("moves down and up through what is visible, not through the data", () => {
    // With adr collapsed, Down from it must reach readme.md, skipping the
    // two children that exist but aren't on screen.
    expect(treeKeyAction("ArrowDown", closed, "docs/adr")).toEqual({ focus: "docs/readme.md" });
    expect(treeKeyAction("ArrowDown", open, "docs/adr")).toEqual({
      focus: "docs/adr/ADR-001.md",
    });
    expect(treeKeyAction("ArrowUp", open, "docs/adr/ADR-001.md")).toEqual({ focus: "docs/adr" });
  });

  it("stops at the ends rather than wrapping", () => {
    expect(treeKeyAction("ArrowUp", open, "docs/adr")).toBeNull();
    expect(treeKeyAction("ArrowDown", open, "docs/readme.md")).toBeNull();
  });

  it("expands a closed folder with Right, then steps into it with a second Right", () => {
    // The bug this guards: treating Right as a toggle, so the second press
    // closes what the first opened.
    expect(treeKeyAction("ArrowRight", closed, "docs/adr")).toEqual({ expand: "docs/adr" });
    expect(treeKeyAction("ArrowRight", open, "docs/adr")).toEqual({
      focus: "docs/adr/ADR-001.md",
    });
  });

  it("does nothing on Right from a file", () => {
    expect(treeKeyAction("ArrowRight", open, "docs/readme.md")).toBeNull();
  });

  it("collapses with Left on an open folder, and escapes to the parent otherwise", () => {
    expect(treeKeyAction("ArrowLeft", open, "docs/adr")).toEqual({ collapse: "docs/adr" });
    expect(treeKeyAction("ArrowLeft", open, "docs/adr/ADR-002.md")).toEqual({
      focus: "docs/adr",
    });
    expect(treeKeyAction("ArrowLeft", open, "docs/readme.md")).toBeNull();
  });

  it("jumps to the first and last visible rows", () => {
    expect(treeKeyAction("Home", open, "docs/readme.md")).toEqual({ focus: "docs/adr" });
    expect(treeKeyAction("End", open, "docs/adr")).toEqual({ focus: "docs/readme.md" });
  });

  it("opens a file with Enter and toggles a folder with it", () => {
    expect(treeKeyAction("Enter", open, "docs/readme.md")).toEqual({ select: "docs/readme.md" });
    expect(treeKeyAction(" ", open, "docs/adr")).toEqual({ collapse: "docs/adr" });
    expect(treeKeyAction(" ", closed, "docs/adr")).toEqual({ expand: "docs/adr" });
  });

  it("typeahead searches forward and wraps around", () => {
    expect(treeKeyAction("r", open, "docs/adr")).toEqual({ focus: "docs/readme.md" });
    // From the last row, "a" has to wrap to find adr again.
    expect(treeKeyAction("a", open, "docs/readme.md")).toEqual({ focus: "docs/adr" });
  });

  it("returns null for keys it does not own, so Tab still works", () => {
    expect(treeKeyAction("Tab", open, "docs/adr")).toBeNull();
    expect(treeKeyAction("Escape", open, "docs/adr")).toBeNull();
  });

  it("returns null when focus is on a row that is no longer visible", () => {
    expect(treeKeyAction("ArrowDown", closed, "docs/adr/ADR-001.md")).toBeNull();
  });
});
