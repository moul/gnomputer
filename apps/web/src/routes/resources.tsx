import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Markdown } from "../shell/markdown-lazy";
import { ErrorState } from "../shell/error-state";
import { buildDocTree, type DocTreeNode } from "../shell/doc-tree";
import { useResourcesStore, type ResourcesTab } from "../shell/resources-store";
import { useStorePersistence } from "../shell/use-store-persistence";

const REPO_TREE_API = "https://api.github.com/repos/gnolang/gno/git/trees/master?recursive=1";
const REPO_RAW_BASE = "https://raw.githubusercontent.com/gnolang/gno/master";
const AWESOME_GNO_RAW_URL = "https://raw.githubusercontent.com/gnolang/awesome-gno/main/README.md";
const AWESOME_GNO_URL = "https://github.com/gnolang/awesome-gno";

const TABS: { id: ResourcesTab; label: string }[] = [
  { id: "docs", label: "Docs" },
  { id: "awesome-gno", label: "awesome-gno" },
  { id: "about", label: "About" },
];

function useRemoteText(url: string) {
  return useQuery({
    queryKey: ["remote-text", url],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.text();
    },
  });
}

export function Resources() {
  useStorePersistence("ui-state:resources", useResourcesStore);
  const tab = useResourcesStore((s) => s.tab);
  const setTab = useResourcesStore((s) => s.setTab);

  return (
    <div className="resources-window">
      <div className="window-tabbar" role="tablist" aria-label="Resources">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="window-tab"
            data-active={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="window-tabbody">
        {tab === "docs" && <DocsTab />}
        {tab === "awesome-gno" && <AwesomeGnoTab />}
        {tab === "about" && <AboutTab />}
      </div>
    </div>
  );
}

// The whole docs/ folder, enumerated live via GitHub's recursive git tree
// API (confirmed CORS-enabled) rather than a hand-picked subset — a real
// directory listing, not a guess at which files matter.
function DocsTab() {
  const selected = useResourcesStore((s) => s.selectedDoc);
  const setSelected = useResourcesStore((s) => s.setSelectedDoc);
  const {
    data: tree,
    error: treeError,
    isPending: treePending,
    refetch: refetchTree,
  } = useQuery({
    queryKey: ["repo-tree", REPO_TREE_API],
    queryFn: async () => {
      const res = await fetch(REPO_TREE_API);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const body = (await res.json()) as { tree: { path: string; type: string }[] };
      const paths = body.tree.filter((t) => t.type === "blob" && t.path.startsWith("docs/")).map((t) => t.path);
      return buildDocTree(paths, "docs/");
    },
  });

  const {
    data: content,
    error: contentError,
    isPending: contentPending,
    refetch: refetchContent,
  } = useRemoteText(selected ? `${REPO_RAW_BASE}/docs/${selected}` : "");

  return (
    <div className="resources-docs">
      <nav aria-label="Docs" className="file-tree doc-tree">
        {treeError ? (
          <ErrorState
            message={`Could not load the docs listing: ${treeError.message}`}
            onRetry={() => void refetchTree()}
          />
        ) : treePending || !tree ? (
          <p className="state-line" aria-busy="true">
            Loading…
          </p>
        ) : (
          <DocTreeView nodes={tree} selected={selected} onSelect={setSelected} />
        )}
      </nav>
      <div className="resources-docs__body">
        {selected === null ? (
          <p className="state-line">Pick a file from the tree to read it.</p>
        ) : contentError ? (
          <ErrorState
            message={`Could not load ${selected}: ${contentError.message}`}
            onRetry={() => void refetchContent()}
          />
        ) : contentPending || content === undefined ? (
          <p className="state-line" aria-busy="true">
            Loading…
          </p>
        ) : (
          <Markdown text={content} />
        )}
      </div>
    </div>
  );
}

function DocTreeView({
  nodes,
  selected,
  onSelect,
}: {
  nodes: DocTreeNode[];
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <ul>
      {nodes.map((node) =>
        node.type === "folder" ? (
          <DocTreeFolder key={node.path} node={node} selected={selected} onSelect={onSelect} />
        ) : (
          <li key={node.path}>
            <button
              type="button"
              aria-current={node.path === `docs/${selected}`}
              onClick={() => onSelect(node.path.replace(/^docs\//, ""))}
            >
              {node.name}
            </button>
          </li>
        )
      )}
    </ul>
  );
}

function DocTreeFolder({
  node,
  selected,
  onSelect,
}: {
  node: DocTreeNode;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <li className="doc-tree__folder">
      <button type="button" className="doc-tree__folder-toggle" onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span> {node.name}/
      </button>
      {open && (
        <div className="doc-tree__folder-body">
          <DocTreeView nodes={node.children ?? []} selected={selected} onSelect={onSelect} />
        </div>
      )}
    </li>
  );
}

function AwesomeGnoTab() {
  const { data: text, error, isPending, refetch } = useRemoteText(AWESOME_GNO_RAW_URL);

  return (
    <div className="resources-awesome-gno">
      <p className="state-line">
        A community-maintained hub of Gno apps, frameworks, and resources.{" "}
        <a href={AWESOME_GNO_URL} target="_blank" rel="noopener noreferrer">
          View on GitHub ↗
        </a>
      </p>
      {error ? (
        <ErrorState
          message={`Could not load awesome-gno: ${error.message}`}
          onRetry={() => void refetch()}
        />
      ) : isPending || text === undefined ? (
        <p className="state-line" aria-busy="true">
          Loading…
        </p>
      ) : (
        <Markdown text={text} />
      )}
    </div>
  );
}

function AboutTab() {
  return (
    <div className="resources-about">
      <h2>Gnomputer</h2>
      <p className="resources-about__tagline">Boot the shared computer.</p>
      <p>
        Gnomputer is a windowed desktop shell for Gno — it unifies realm browsing, source
        inspection, state exploration, block and validator monitoring, and account lookup into
        one environment, instead of a collection of separate blockchain websites.
      </p>
      <p>
        It&rsquo;s meant to make Gno feel like a living, inspectable computer rather than just a
        chain explorer or a wrapper around gnoweb — everything here runs entirely in your
        browser, talking directly to a Gno RPC endpoint, with no server of its own in between.
      </p>
      <p>
        Currently guest/read-only — wallet connection and transaction signing aren&rsquo;t wired
        up yet, so actions that would need one (deploying a realm, calling a mutating function)
        are visible but disabled throughout the app.
      </p>
      <a className="resources-about__repo-link" href={__GIT_REPO__} target="_blank" rel="noopener noreferrer">
        View source on GitHub ↗
      </a>
    </div>
  );
}
