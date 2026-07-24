import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { useLiveEvents } from "../use-live-events";
import { useRecentlyAddedPackages } from "../use-recently-added-packages";
import { rankByActivity } from "../rank-by-activity";
import { Linkified } from "../shell/linkify";
import { Freshness } from "../shell/freshness";
import { ErrorState } from "../shell/error-state";
import { useRealmTabsStore, type RealmLens, type RealmTab } from "../shell/realm-tabs-store";
import { openInRealmTab } from "../shell/open-in-realm-tab";
import { gnowebRealmUrl } from "../shell/gnoweb-links";
import { router } from "../routes/root";
import { SourceExplorer } from "./source-explorer";
import { RealmDocs } from "./realm-docs";
import { RealmState } from "./realm-state";
import { RealmHistory } from "./realm-history";
import { RealmActions } from "./realm-actions";
import { RealmGraph } from "./realm-graph";
import { RealmRaw } from "./realm-raw";
import { KNOWN_REALMS } from "../known-realms";
import { GNOLAND_OFFICIAL_PAGES } from "../gnoland-official-pages";
import { formatRealmLabel } from "../shell/format-realm-label";
import { useRealmSuggestions } from "../shell/use-realm-suggestions";
import { useBrowserHomeStore } from "../shell/browser-home-store";
import { LensTabBar, type LensTabBarItem } from "../shell/lens-tab-bar";
import type { RenderNode } from "@gnomputer/lenses";

const LENS_TABS: { id: RealmLens; label: string }[] = [
  { id: "render", label: "Render" },
  { id: "source", label: "Source" },
  { id: "docs", label: "Docs" },
  { id: "state", label: "State" },
  { id: "history", label: "History" },
  { id: "actions", label: "Actions" },
  { id: "graph", label: "Graph" },
  { id: "raw", label: "Raw" },
];

export function RealmBrowser({
  windowId,
  packagePath: urlPackagePath,
  renderPath: urlRenderPath,
}: {
  windowId: string;
  packagePath?: string;
  renderPath?: string;
}) {
  const ensureWindow = useRealmTabsStore((s) => s.ensureWindow);
  const win = useRealmTabsStore((s) => s.windows[windowId]);
  const openTab = useRealmTabsStore((s) => s.openTab);
  const closeTab = useRealmTabsStore((s) => s.closeTab);
  const setActiveTab = useRealmTabsStore((s) => s.setActiveTab);
  const popOutActiveTab = useRealmTabsStore((s) => s.popOutActiveTab);
  const isPrimary = windowId === "realm";

  useEffect(() => {
    ensureWindow(windowId);
  }, [windowId, ensureWindow]);

  // Primary window only: when the URL changes (a Linkify click, a shared
  // link, browser back/forward), bring the active tab in line with it. Tab
  // switches and in-tab navigation flow the other direction (see selectTab
  // and openInRealmTab) — this effect exists only to react to external URL
  // changes, so it deliberately does not depend on tab/window state.
  useEffect(() => {
    if (!isPrimary || urlPackagePath === undefined) return;
    const state = useRealmTabsStore.getState();
    const current = state.windows[windowId];
    const activeTab = current?.tabs.find((t) => t.id === current.activeTabId);
    if (!activeTab) return;
    if (activeTab.packagePath === urlPackagePath && activeTab.renderPath === (urlRenderPath ?? "")) {
      return;
    }
    openInRealmTab(windowId, { packagePath: urlPackagePath, renderPath: urlRenderPath });
  }, [isPrimary, urlPackagePath, urlRenderPath, windowId]);

  if (!win) return null;

  const activeTab = win.tabs.find((t) => t.id === win.activeTabId) ?? win.tabs[0]!;

  function selectTab(tabId: string) {
    setActiveTab(windowId, tabId);
    if (!isPrimary) return;
    const tab = win!.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    void router.navigate({
      to: "/",
      search:
        tab.packagePath === ""
          ? {}
          : tab.renderPath
            ? { pkg: tab.packagePath, path: tab.renderPath }
            : { pkg: tab.packagePath },
    });
  }

  return (
    <div className="realm-browser">
      <div className="realm-browser__chrome">
        <div className="realm-browser__tabstrip" role="tablist" aria-label="Open realms">
          {win.tabs.map((t) => (
            <span
              key={t.id}
              className="realm-browser__tabstrip-item"
              data-active={t.id === win.activeTabId}
            >
              <button type="button" onClick={() => selectTab(t.id)}>
                {t.packagePath === "" ? "🏠 Home" : formatRealmLabel(t.packagePath, 18)}
              </button>
              {win.tabs.length > 1 && (
                <button
                  type="button"
                  className="realm-browser__tab-close"
                  aria-label="Close tab"
                  onClick={() => closeTab(windowId, t.id)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          <button
            type="button"
            className="realm-browser__tab-new"
            aria-label="New tab"
            title="New tab"
            onClick={() => openTab(windowId)}
          >
            +
          </button>
          <button
            type="button"
            className="realm-browser__tab-popout"
            aria-label="Open in a new window"
            title="Open this tab in its own window"
            onClick={() => popOutActiveTab(windowId)}
          >
            ⧉
          </button>
        </div>
        <RealmUrlBar windowId={windowId} tab={activeTab} />
      </div>
      <RealmTabBody windowId={windowId} tab={activeTab} />
    </div>
  );
}

function RealmUrlBar({ windowId, tab }: { windowId: string; tab: RealmTab }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const [draftPackagePath, setDraftPackagePath] = useState(tab.packagePath);
  const [focused, setFocused] = useState(false);
  const hasPackage = tab.packagePath !== "";
  const suggestions = useRealmSuggestions(focused, draftPackagePath);
  const suggestionsListId = `realm-suggestions-${windowId}`;

  // Independent from RealmRenderView's own render query below — this only
  // needs to know whether the committed path resolves at all, and must
  // reflect that regardless of which lens tab (Source, State, ...) is
  // actually showing, not only while the Render lens happens to be mounted.
  const { isFetching, isError } = useQuery({
    queryKey: ["realm-exists", networkId, tab.packagePath, tab.renderPath],
    queryFn: () => sdk.rpc.queryRender(tab.packagePath, tab.renderPath, new Date().toISOString()),
    enabled: hasPackage,
    retry: false,
  });
  const status = !hasPackage ? undefined : isFetching ? "loading" : isError ? "error" : "ok";

  useEffect(() => {
    setDraftPackagePath(tab.packagePath);
  }, [tab.packagePath]);

  function openPackage(pkg: string) {
    openInRealmTab(windowId, { packagePath: pkg });
  }

  return (
    <form
      className="open-package-form realm-browser__urlbar"
      onSubmit={(e) => {
        e.preventDefault();
        if (draftPackagePath === "") return;
        openPackage(draftPackagePath);
      }}
    >
      <label>
        Realm path
        <input
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-status={status}
          value={draftPackagePath}
          onChange={(e) => setDraftPackagePath(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          list={suggestionsListId}
          placeholder="gno.land/r/sys/names"
        />
        <datalist id={suggestionsListId}>
          {suggestions.map((s) => (
            <option key={s.packagePath} value={s.packagePath} label={s.label} />
          ))}
        </datalist>
      </label>
      <button type="submit">Open</button>
      <button
        type="button"
        disabled={!hasPackage}
        onClick={() => openInRealmTab(windowId, { packagePath: "" })}
      >
        🏠 Home
      </button>
    </form>
  );
}

interface RenderStats {
  updatedAt: number;
  loadMs: number;
  refetch: () => void;
}

function RealmTabBody({ windowId, tab }: { windowId: string; tab: RealmTab }) {
  const [renderStats, setRenderStats] = useState<RenderStats | null>(null);
  const hasPackage = tab.packagePath !== "";

  function openPackage(pkg: string, renderPath?: string) {
    openInRealmTab(windowId, { packagePath: pkg, renderPath });
  }

  if (!hasPackage) {
    return <RealmBrowserHome onOpen={openPackage} />;
  }

  return (
    <>
      <div className="realm-browser__lens-body">
        {tab.lens === "render" ? (
          <RealmRenderView
            windowId={windowId}
            packagePath={tab.packagePath}
            renderPath={tab.renderPath}
            onStats={setRenderStats}
          />
        ) : tab.lens === "source" ? (
          <SourceExplorer packagePath={tab.packagePath} />
        ) : tab.lens === "docs" ? (
          <RealmDocs packagePath={tab.packagePath} />
        ) : tab.lens === "state" ? (
          <RealmState packagePath={tab.packagePath} />
        ) : tab.lens === "history" ? (
          <RealmHistory packagePath={tab.packagePath} />
        ) : tab.lens === "actions" ? (
          <RealmActions packagePath={tab.packagePath} />
        ) : tab.lens === "graph" ? (
          <RealmGraph packagePath={tab.packagePath} windowId={windowId} />
        ) : (
          <RealmRaw packagePath={tab.packagePath} renderPath={tab.renderPath} />
        )}
      </div>
      <RealmStatusBar windowId={windowId} tab={tab} renderStats={renderStats} />
    </>
  );
}

function RealmStatusBar({
  windowId,
  tab,
  renderStats,
}: {
  windowId: string;
  tab: RealmTab;
  renderStats: RenderStats | null;
}) {
  const sdk = useSdk();
  const updateActiveTab = useRealmTabsStore((s) => s.updateActiveTab);
  const gnowebUrl = sdk.networks.getActive().gnowebUrl;

  const items: LensTabBarItem[] = [
    ...LENS_TABS.map((lensTab) => ({
      key: lensTab.id,
      label: lensTab.label,
      active: tab.lens === lensTab.id,
      onClick: () => updateActiveTab(windowId, { lens: lensTab.id }),
    })),
    ...(gnowebUrl
      ? [
          {
            key: "gnoweb",
            label: "Open on gnoweb ↗",
            href: gnowebRealmUrl(gnowebUrl, tab.packagePath, tab.renderPath || undefined),
          },
        ]
      : []),
  ];

  return (
    <footer className="realm-browser__statusbar">
      <LensTabBar items={items} ariaLabel="Realm view" />
      <div className="realm-browser__statusbar-stats">
        {tab.lens === "render" && renderStats && (
          <>
            <span>Loaded in {renderStats.loadMs}ms</span>
            <Freshness dataUpdatedAt={renderStats.updatedAt} />
            <button
              type="button"
              className="realm-browser__refresh"
              aria-label="Refresh"
              title="Refresh"
              onClick={renderStats.refetch}
            >
              ↻
            </button>
          </>
        )}
      </div>
    </footer>
  );
}

function RealmRenderView({
  windowId,
  packagePath,
  renderPath,
  onStats,
}: {
  windowId: string;
  packagePath: string;
  renderPath: string;
  onStats?: (stats: RenderStats) => void;
}) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  const trailLabel = renderPath ? `${packagePath} (${renderPath})` : packagePath;
  useTrailRecorder({
    uri: `gno://${networkId}/realm/${packagePath}${renderPath ? `#${renderPath}` : ""}`,
    label: trailLabel,
  });

  const {
    data,
    error,
    isPending,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["realm-render", networkId, packagePath, renderPath],
    queryFn: async () => {
      const start = performance.now();
      const env = await sdk.rpc.queryRender(packagePath, renderPath, new Date().toISOString());
      const nodes = sdk.lenses.parseRender(env.data, packagePath);
      return { nodes, loadMs: Math.round(performance.now() - start) };
    },
  });

  useEffect(() => {
    if (data) onStats?.({ updatedAt: dataUpdatedAt, loadMs: data.loadMs, refetch: () => void refetch() });
  }, [data, dataUpdatedAt, onStats, refetch]);

  if (error) {
    return (
      <ErrorState message={`Could not load this realm: ${error.message}`} onRetry={() => void refetch()} />
    );
  }
  if (isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Loading realm…
      </p>
    );
  }
  return (
    <article aria-label={`Realm ${packagePath}`}>
      {data.nodes.map((node, i) => (
        <RenderNodeView key={i} node={node} windowId={windowId} />
      ))}
    </article>
  );
}

function CollapsibleSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const collapsed = useBrowserHomeStore((s) => !!s.collapsed[id]);
  const toggleSection = useBrowserHomeStore((s) => s.toggleSection);

  return (
    <section className="realm-browser-home__section" data-collapsed={collapsed}>
      <button
        type="button"
        className="realm-browser-home__section-header"
        onClick={() => toggleSection(id)}
        aria-expanded={!collapsed}
      >
        <span className="realm-browser-home__section-caret" aria-hidden="true">
          {collapsed ? "▸" : "▾"}
        </span>
        <h3>{title}</h3>
      </button>
      {!collapsed && <div className="realm-browser-home__section-body">{children}</div>}
    </section>
  );
}

// Realm discovery mostly needs the indexer to enumerate anything beyond a
// single known package, and that indexer doesn't allow browser access
// (ADR-012/015, confirmed still true live — see rpc/src/indexer.ts). What's
// genuinely available without it: a curated list, "recently active" (ranked
// from live chain events since this window opened) and "recently added"
// (vm/qpaths polled for packages that weren't there last time, i.e. a real
// prefix scan over deployed packages — see use-recently-added-packages.ts).
function RealmBrowserHome({ onOpen }: { onOpen: (packagePath: string, renderPath?: string) => void }) {
  const { events } = useLiveEvents(false);
  const activity = rankByActivity(events);
  const recentlyAdded = useRecentlyAddedPackages(true);
  const staffPicks = KNOWN_REALMS.filter((r) => !r.system);
  const systemRealms = KNOWN_REALMS.filter((r) => r.system);

  return (
    <div className="realm-browser-home">
      <CollapsibleSection id="gnoland" title="gno.land">
        <ul className="realm-browser-home__list">
          {GNOLAND_OFFICIAL_PAGES.map((page) => (
            <li key={page.label}>
              <button type="button" onClick={() => onOpen(page.packagePath, page.renderPath)}>
                {page.label}
                <span className="realm-browser-home__path">
                  {page.packagePath}
                  {page.renderPath ? `:${page.renderPath}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection id="recently-active" title="Recently active">
        {activity.length === 0 ? (
          <p className="state-line" aria-busy="true">
            Watching the chain for activity…
          </p>
        ) : (
          <ul className="realm-browser-home__list">
            {activity.map((row) => (
              <li key={row.packagePath}>
                <button type="button" onClick={() => onOpen(row.packagePath)}>
                  {row.packagePath}
                  <span className="realm-browser-home__path">
                    {row.eventCount} recent {row.eventCount === 1 ? "event" : "events"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="state-line">
          Ranked from live events seen since this window opened — not a historical or complete
          ranking, which would need the indexer.
        </p>
      </CollapsibleSection>

      <CollapsibleSection id="recently-added" title="Recently added">
        {recentlyAdded.length === 0 ? (
          <p className="state-line" aria-busy="true">
            Watching for newly deployed packages…
          </p>
        ) : (
          <ul className="realm-browser-home__list">
            {recentlyAdded.map((path) => (
              <li key={path}>
                <button type="button" onClick={() => onOpen(path)}>
                  {path}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      <CollapsibleSection id="staff-picks" title="Staff picks">
        <ul className="realm-browser-home__list">
          {staffPicks.map((pick) => (
            <li key={pick.packagePath}>
              <button type="button" onClick={() => onOpen(pick.packagePath)}>
                {pick.label}
                <span className="realm-browser-home__path">{pick.packagePath}</span>
              </button>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection id="system-realms" title="System realms">
        <ul className="realm-browser-home__list">
          {systemRealms.map((pick) => (
            <li key={pick.packagePath}>
              <button type="button" onClick={() => onOpen(pick.packagePath)}>
                {pick.label}
                <span className="realm-browser-home__path">{pick.packagePath}</span>
              </button>
            </li>
          ))}
        </ul>
      </CollapsibleSection>
    </div>
  );
}

function RenderNodeView({ node, windowId }: { node: RenderNode; windowId: string }) {
  switch (node.type) {
    case "heading":
      return (
        <h2>
          <Linkified text={node.content ?? ""} />
        </h2>
      );
    case "code":
      return <pre>{node.content}</pre>;
    case "link":
      return <GnoLink node={node} windowId={windowId} />;
    case "paragraph":
      return (
        <p>
          {node.content !== undefined ? (
            <Linkified text={node.content} />
          ) : (
            node.children?.map((c, i) => <RenderNodeView key={i} node={c} windowId={windowId} />)
          )}
        </p>
      );
    default:
      return (
        <span>
          <Linkified text={node.content ?? ""} />
        </span>
      );
  }
}

function GnoLink({ node, windowId }: { node: RenderNode; windowId: string }) {
  if (node.ref?.packagePath) {
    const packagePath = node.ref.packagePath;
    const renderPath = node.renderPath ?? "";
    return (
      <a
        href={`/?pkg=${encodeURIComponent(packagePath)}${renderPath ? `&path=${encodeURIComponent(renderPath)}` : ""}`}
        onClick={(e) => {
          e.preventDefault();
          openInRealmTab(windowId, { packagePath, renderPath });
        }}
      >
        {node.content}
      </a>
    );
  }

  return (
    <a href={node.href} target="_blank" rel="noopener noreferrer">
      {node.content}
    </a>
  );
}
