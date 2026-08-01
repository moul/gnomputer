import { useEffect, useMemo, useRef, useState } from "react";
import type { DocTreeNode } from "./doc-tree";
import { flattenTree, treeKeyAction } from "./tree-keys";

/** The docs sidebar, as an actual tree.
 *
 * It used to be nested `<ul>`s of `<button>`s: no `role="tree"`, so nothing
 * conveyed the hierarchy, the expanded state, or how deep a file sat; and
 * every folder toggle and every file was its own tab stop, so reaching the
 * bottom of a few-hundred-entry docs listing meant a few hundred Tabs
 * (AUD-020).
 *
 * Now it is one tab stop with the APG tree keyboard pattern behind it — see
 * `tree-keys.ts`, where that logic lives as a pure function. */
export function DocTreeView({
  nodes,
  selected,
  onSelect,
}: {
  nodes: DocTreeNode[];
  /** The selected file's path with the "docs/" prefix already stripped, as
   * the containing route stores it. */
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => collectFolders(nodes));
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const shouldFocus = useRef(false);

  const visible = useMemo(() => flattenTree(nodes, expanded), [nodes, expanded]);

  // Newly discovered folders start open, matching the old behaviour of
  // rendering every folder expanded.
  useEffect(() => setExpanded(collectFolders(nodes)), [nodes]);

  const selectedPath = selected === null ? null : `docs/${selected}`;
  // The tree needs exactly one tab stop. Prefer the selected row, then the
  // one last arrowed to, then the first — never none, or the whole tree
  // drops out of the tab order.
  const activePath =
    (focusPath && visible.some((n) => n.path === focusPath) ? focusPath : null) ??
    (selectedPath && visible.some((n) => n.path === selectedPath) ? selectedPath : null) ??
    visible[0]?.path ??
    null;

  useEffect(() => {
    if (!shouldFocus.current || !activePath) return;
    shouldFocus.current = false;
    rowRefs.current.get(activePath)?.focus();
  }, [activePath]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || !activePath) return;
    const action = treeKeyAction(event.key, visible, activePath);
    if (!action) return;
    event.preventDefault();

    if (action.expand) setExpanded((current) => new Set(current).add(action.expand!));
    if (action.collapse) {
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(action.collapse!);
        return next;
      });
    }
    if (action.select) onSelect(action.select.replace(/^docs\//, ""));
    if (action.focus) {
      shouldFocus.current = true;
      setFocusPath(action.focus);
    }
  }

  return (
    <ul role="tree" aria-label="Docs" className="doc-tree" onKeyDown={handleKeyDown}>
      {visible.map((node) => {
        const isSelected = node.type === "file" && node.path === selectedPath;
        return (
          <li
            key={node.path}
            ref={(element) => {
              if (element) rowRefs.current.set(node.path, element);
              else rowRefs.current.delete(node.path);
            }}
            role="treeitem"
            // aria-level is what carries the structure once the DOM is
            // flat. Flattening is deliberate: nested <ul>s would need a
            // role="group" wrapper per level and would keep the roving
            // tabindex and the visible-order arrow keys out of step with
            // each other.
            aria-level={node.level}
            aria-expanded={node.type === "folder" ? node.expanded : undefined}
            aria-selected={node.type === "file" ? isSelected : undefined}
            tabIndex={node.path === activePath ? 0 : -1}
            className={
              node.type === "folder" ? "doc-tree__row doc-tree__row--folder" : "doc-tree__row"
            }
            style={{ paddingLeft: `calc(var(--space-3) * ${node.level - 1})` }}
            data-selected={isSelected ? "true" : undefined}
            onFocus={() => setFocusPath(node.path)}
            onClick={() => {
              if (node.type === "folder") {
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(node.path)) next.delete(node.path);
                  else next.add(node.path);
                  return next;
                });
              } else {
                onSelect(node.path.replace(/^docs\//, ""));
              }
              setFocusPath(node.path);
            }}
          >
            {node.type === "folder" && <span aria-hidden="true">{node.expanded ? "▾" : "▸"}</span>}{" "}
            {node.type === "folder" ? `${node.name}/` : node.name}
          </li>
        );
      })}
    </ul>
  );
}

function collectFolders(nodes: DocTreeNode[], into = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    into.add(node.path);
    collectFolders(node.children ?? [], into);
  }
  return into;
}
