export interface DocTreeNode {
  name: string;
  /** Full repo-relative path — only meaningful for a file node (folders are
   * purely organizational and never fetched themselves). */
  path: string;
  type: "file" | "folder";
  children?: DocTreeNode[];
}

/** Builds a real nested folder/file tree from a flat list of repo-relative
 * paths (as returned by GitHub's recursive git tree API) — e.g.
 * ["docs/adr/ADR-001-x.md", "docs/product/spec.md"] becomes two folders
 * ("adr", "product") each containing one file, with `stripPrefix` (here
 * "docs/") removed from the tree's own structure since the containing UI
 * already establishes that context. Folders sort before files, both
 * alphabetically, at every level. */
export function buildDocTree(paths: string[], stripPrefix: string): DocTreeNode[] {
  const root: DocTreeNode[] = [];

  for (const fullPath of paths) {
    if (!fullPath.startsWith(stripPrefix)) continue;
    const relative = fullPath.slice(stripPrefix.length);
    const parts = relative.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let siblings = root;
    let accumulated = stripPrefix.replace(/\/$/, "");
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!;
      accumulated = `${accumulated}/${name}`;
      const isFile = i === parts.length - 1;
      let node = siblings.find((n) => n.name === name);
      if (!node) {
        node = { name, path: accumulated, type: isFile ? "file" : "folder", children: isFile ? undefined : [] };
        siblings.push(node);
      }
      if (!isFile) siblings = node.children!;
    }
  }

  sortTree(root);
  return root;
}

function sortTree(nodes: DocTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children) sortTree(node.children);
  }
}
