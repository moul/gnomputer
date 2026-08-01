import type { DocTreeNode } from "./doc-tree";

export interface VisibleTreeNode {
  path: string;
  name: string;
  type: "file" | "folder";
  /** 1-based, as `aria-level` wants it. */
  level: number;
  expanded: boolean;
  parentPath: string | null;
}

/** The rows a tree is currently showing, in the order a user tabs/arrows
 * through them. Collapsed folders contribute themselves but not their
 * children — keyboard navigation must follow what is on screen, not the
 * underlying data. */
export function flattenTree(
  nodes: DocTreeNode[],
  expanded: ReadonlySet<string>,
  level = 1,
  parentPath: string | null = null
): VisibleTreeNode[] {
  const out: VisibleTreeNode[] = [];
  for (const node of nodes) {
    const isOpen = node.type === "folder" && expanded.has(node.path);
    out.push({
      path: node.path,
      name: node.name,
      type: node.type,
      level,
      expanded: isOpen,
      parentPath,
    });
    if (isOpen) out.push(...flattenTree(node.children ?? [], expanded, level + 1, node.path));
  }
  return out;
}

export interface TreeAction {
  focus?: string;
  expand?: string;
  collapse?: string;
  select?: string;
}

/** The APG tree keyboard pattern, as a pure function.
 *
 * The docs sidebar was a set of nested buttons: Tab was the only way through
 * it, every folder toggle and every file was its own tab stop, and nothing
 * told assistive tech that the structure was a tree at all (AUD-020).
 *
 * Returns null when the key isn't ours, so the caller knows not to
 * preventDefault — swallowing Tab or a browser shortcut here would be worse
 * than the gap being fixed. */
export function treeKeyAction(
  key: string,
  visible: VisibleTreeNode[],
  currentPath: string
): TreeAction | null {
  const index = visible.findIndex((n) => n.path === currentPath);
  if (index === -1) return null;
  const current = visible[index]!;

  switch (key) {
    case "ArrowDown": {
      const next = visible[index + 1];
      return next ? { focus: next.path } : null;
    }
    case "ArrowUp": {
      const previous = visible[index - 1];
      return previous ? { focus: previous.path } : null;
    }
    case "ArrowRight": {
      if (current.type !== "folder") return null;
      if (!current.expanded) return { expand: current.path };
      // Already open: right moves *into* it, which is why this can't just be
      // "toggle" — a second Right must not close what the first opened.
      const child = visible[index + 1];
      return child && child.parentPath === current.path ? { focus: child.path } : null;
    }
    case "ArrowLeft": {
      if (current.type === "folder" && current.expanded) return { collapse: current.path };
      if (!current.parentPath) return null;
      return { focus: current.parentPath };
    }
    case "Home":
      return visible[0] ? { focus: visible[0].path } : null;
    case "End":
      return visible[visible.length - 1] ? { focus: visible[visible.length - 1]!.path } : null;
    case "Enter":
    case " ":
      if (current.type === "folder") {
        return current.expanded ? { collapse: current.path } : { expand: current.path };
      }
      return { select: current.path };
    default: {
      // Typeahead. A docs tree runs to a few hundred entries, so arrowing to
      // "r/" from the top is a long trip.
      if (key.length !== 1 || !/\S/.test(key)) return null;
      const lower = key.toLowerCase();
      const order = [...visible.slice(index + 1), ...visible.slice(0, index)];
      const match = order.find((n) => n.name.toLowerCase().startsWith(lower));
      return match ? { focus: match.path } : null;
    }
  }
}
