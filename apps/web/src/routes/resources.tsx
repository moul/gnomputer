import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseRenderMarkup } from "@gnomputer/lenses";
import { KNOWN_DOCS } from "../known-docs";
import { MarkdownView } from "../shell/markdown-view";
import { ErrorState } from "../shell/error-state";

const REPO_RAW_BASE = "https://raw.githubusercontent.com/moul/gnomputer/main";
const AWESOME_GNO_RAW_URL = "https://raw.githubusercontent.com/gnolang/awesome-gno/main/README.md";
const AWESOME_GNO_URL = "https://github.com/gnolang/awesome-gno";

type ResourcesTab = "docs" | "awesome-gno" | "about";

const TABS: { id: ResourcesTab; label: string }[] = [
  { id: "docs", label: "Docs" },
  { id: "awesome-gno", label: "awesome-gno" },
  { id: "about", label: "About" },
];

// Fetched live from GitHub rather than bundled at build time (see
// known-docs.ts) — both raw.githubusercontent.com URLs used here are
// confirmed to send Access-Control-Allow-Origin: *, so this works as a
// genuine live fetch, no proxy needed.
function useRemoteMarkdown(url: string) {
  return useQuery({
    queryKey: ["remote-markdown", url],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const text = await res.text();
      return parseRenderMarkup(text, "");
    },
  });
}

export function Resources() {
  const [tab, setTab] = useState<ResourcesTab>("docs");

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

// Bundled from a hand-picked subset of this repo's own docs/ folder — see
// known-docs.ts for why only docs/adr/** and docs/product/** are listed.
// A real, dynamic "browse whatever's actually in docs/" version needs a
// platform-hosted index this client can enumerate, which doesn't exist yet.
function DocsTab() {
  const [selected, setSelected] = useState(KNOWN_DOCS[0]!.path);
  const doc = KNOWN_DOCS.find((d) => d.path === selected)!;
  const { data: nodes, error, isPending, refetch } = useRemoteMarkdown(`${REPO_RAW_BASE}/${selected}`);

  return (
    <div className="resources-docs">
      <nav aria-label="Docs" className="file-tree">
        <ul>
          {KNOWN_DOCS.map((d) => (
            <li key={d.path}>
              <button type="button" aria-current={d.path === selected} onClick={() => setSelected(d.path)}>
                {d.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="resources-docs__body">
        {error ? (
          <ErrorState
            message={`Could not load ${doc.label}: ${error.message}`}
            onRetry={() => void refetch()}
          />
        ) : isPending || !nodes ? (
          <p className="state-line" aria-busy="true">
            Loading…
          </p>
        ) : (
          <MarkdownView nodes={nodes} />
        )}
      </div>
    </div>
  );
}

function AwesomeGnoTab() {
  const { data: nodes, error, isPending, refetch } = useRemoteMarkdown(AWESOME_GNO_RAW_URL);

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
      ) : isPending || !nodes ? (
        <p className="state-line" aria-busy="true">
          Loading…
        </p>
      ) : (
        <MarkdownView nodes={nodes} />
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
