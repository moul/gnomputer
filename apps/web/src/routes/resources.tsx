import { useQuery } from "@tanstack/react-query";
import { Markdown } from "../shell/markdown-lazy";
import { ErrorState } from "../shell/error-state";
import { buildDocTree } from "../shell/doc-tree";
import { fetchRemoteJson, fetchRemoteText } from "../shell/remote-content";
import { DocTreeView } from "../shell/doc-tree-view";
import { useResourcesStore, type ResourcesTab } from "../shell/resources-store";
import { useStorePersistence } from "../shell/use-store-persistence";
import { SHORTCUTS } from "../shell/shortcuts-help";

const REPO_ROOT_TREE_API = "https://api.github.com/repos/gnolang/gno/git/trees/master";
const REPO_RAW_BASE = "https://raw.githubusercontent.com/gnolang/gno/master";
const AWESOME_GNO_RAW_URL = "https://raw.githubusercontent.com/gnolang/awesome-gno/main/README.md";
const AWESOME_GNO_URL = "https://github.com/gnolang/awesome-gno";

const TABS: { id: ResourcesTab; label: string }[] = [
  { id: "docs", label: "Docs" },
  { id: "awesome-gno", label: "awesome-gno" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "about", label: "About" },
];

function useRemoteText(url: string) {
  return useQuery({
    queryKey: ["remote-text", url],
    // signal is react-query's — passing it through is what makes an
    // unmounted window's fetch actually stop.
    queryFn: ({ signal }) => fetchRemoteText(url, signal),
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
        {tab === "shortcuts" && <ShortcutsTab />}
        {tab === "about" && <AboutTab />}
      </div>
    </div>
  );
}

// The whole docs/ folder, enumerated live via GitHub's git tree API
// (confirmed CORS-enabled) rather than a hand-picked subset — a real
// directory listing, not a guess at which files matter.
//
// Two requests rather than one, deliberately. The root tree is fetched
// NON-recursively purely to find docs/'s own tree sha (measured 2026-08-01:
// 32 entries, 8.6KB), then that subtree recursively (21KB). Fetching the
// root recursively instead would pull the whole ~9,600-entry monorepo tree
// to keep 73 of its entries.
function DocsTab() {
  const selected = useResourcesStore((s) => s.selectedDoc);
  const setSelected = useResourcesStore((s) => s.setSelectedDoc);
  const {
    data: tree,
    error: treeError,
    isPending: treePending,
    refetch: refetchTree,
  } = useQuery({
    queryKey: ["repo-tree", REPO_ROOT_TREE_API],
    queryFn: async ({ signal }) => {
      const rootBody = await fetchRemoteJson<{
        tree: { path: string; type: string; sha: string }[];
      }>(REPO_ROOT_TREE_API, signal);
      const docsEntry = rootBody.tree.find((t) => t.path === "docs" && t.type === "tree");
      if (!docsEntry) throw new Error("docs/ not found in gnolang/gno's root tree");

      const docsBody = await fetchRemoteJson<{ tree: { path: string; type: string }[] }>(
        `https://api.github.com/repos/gnolang/gno/git/trees/${docsEntry.sha}?recursive=1`,
        signal
      );
      const paths = docsBody.tree.filter((t) => t.type === "blob").map((t) => `docs/${t.path}`);
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
      <nav className="file-tree doc-tree-wrap">
        {treeError ? (
          <ErrorState
            message="Could not load the docs listing" error={treeError}
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
            message={`Could not load ${selected}`} error={contentError}
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
          message="Could not load awesome-gno" error={error}
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

function ShortcutsTab() {
  return (
    <div className="resources-shortcuts">
      <p className="state-line">The same shortcuts as the in-app help (⌘/ or ?), for reference.</p>
      <dl className="resources-shortcuts__list">
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="resources-shortcuts__row">
            <dt>{s.keys}</dt>
            <dd>{s.description}</dd>
          </div>
        ))}
      </dl>
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
