import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { useLiveEvents } from "../use-live-events";
import { useRecentlyAddedPackages } from "../use-recently-added-packages";
import { rankByActivity } from "../rank-by-activity";
import { Freshness } from "../shell/freshness";
import { ErrorState } from "../shell/error-state";
import { useRealmTabsStore, type RealmLens, type RealmTab } from "../shell/realm-tabs-store";
import { useRealmRender } from "../shell/use-realm-render";
import { NoRenderDeclError } from "@gnomputer/app-sdk";
import { applyUrlToActiveTab, openInRealmTab } from "../shell/open-in-realm-tab";
import { gnowebRealmUrl } from "../shell/gnoweb-links";
import { router } from "../routes/root";
import { SourceExplorer } from "./source-explorer";
import { RealmDocs } from "./realm-docs";
import { RealmState } from "./realm-state";
import { RealmStateExplorer } from "./realm-state-explorer";
import { RealmHistory } from "./realm-history";
import { RealmActions } from "./realm-actions";
import { RealmGraph } from "./realm-graph";
import { RealmRaw } from "./realm-raw";
import { KNOWN_REALMS } from "../known-realms";
import { formatRealmLabel } from "../shell/format-realm-label";
import { useRealmSuggestions } from "../shell/use-realm-suggestions";
import { Combobox } from "../shell/combobox";
import { smartTruncateRealmPath } from "../shell/smart-truncate-realm-path";
import { useBrowserHomeStore } from "../shell/browser-home-store";
import { useRealmChangeWatch, type RealmChange } from "../use-realm-change-watch";
import { ShareLinkButton } from "../shell/share-link-button";
import {
  favoriteUri,
  toggleFavorite,
  useFavoriteRealms,
  useFavorites,
} from "../shell/favorites-store";
import { LensTabBar, type LensTabBarItem } from "../shell/lens-tab-bar";
import { RenderNodeView } from "../shell/render-node-view";
import { formatNumber } from "../format-number";
import { useNoRenderStore } from "../shell/no-render-store";

const LENS_TABS: { id: RealmLens; label: string }[] = [
  { id: "render", label: "Render" },
  { id: "source", label: "Source" },
  { id: "docs", label: "Docs" },
  { id: "state-explorer", label: "State" },
  { id: "state", label: "Eval" },
  { id: "history", label: "History" },
  { id: "actions", label: "Actions" },
  { id: "graph", label: "Graph" },
  { id: "raw", label: "Raw" },
];

export function RealmBrowser({
  windowId,
  packagePath: urlPackagePath,
  renderPath: urlRenderPath,
  lens: urlLens,
}: {
  windowId: string;
  packagePath?: string;
  renderPath?: string;
  lens?: RealmLens;
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
  // and openInRealmTab).
  //
  // This raced the persisted tabs, and whichever landed second decided which
  // of two bugs you got. Restoring merges saved windows over the store, so
  // when it landed late it overwrote the tab a link had just set — the reader
  // got their own last-used realm under the linked realm's title. When it
  // landed early, this effect saw the restored tab and read a bare "/" as
  // "go Home", wiping the session that had just come back.
  //
  // Applied immediately rather than waiting for restoration: deferring meant
  // the Home view mounted first and issued its own queries (AUD-026's
  // duplicate-fetch guard catches that). Restoration defers to `urlSeeded`
  // instead, so the ordering no longer matters.
  const coldLoadHandled = useRef(false);
  useEffect(() => {
    if (!isPrimary || urlPackagePath === undefined) return;
    if (!coldLoadHandled.current) {
      coldLoadHandled.current = true;
      // Two intents look identical here on a cold load: a link names what to
      // show, a bare visit resumes what was open. Only a link overrides the
      // restored tab. Every later run is a real URL change, where clearing
      // pkg (Home, or Back out of a realm) does mean go Home.
      if (!urlPackagePath) return;
      useRealmTabsStore.getState().markUrlSeeded(windowId);
    }
    applyUrlToActiveTab(windowId, urlPackagePath, urlRenderPath, urlLens);
  }, [isPrimary, urlPackagePath, urlRenderPath, urlLens, windowId]);

  if (!win) return null;

  const activeTab = win.tabs.find((t) => t.id === win.activeTabId) ?? win.tabs[0]!;

  // Arrow-key navigation is what role="tablist" promises; without it the
  // role was claiming behaviour that didn't exist.
  function onTabKeyDown(e: React.KeyboardEvent) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const tabs = win!.tabs;
    const current = tabs.findIndex((t) => t.id === win!.activeTabId);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : // Wraps, so the cycle has no dead ends.
            (current + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const target = tabs[next];
    if (!target) return;
    selectTab(target.id);
    // Move real focus with the selection, or the roving tabindex leaves
    // focus stranded on a tab that is no longer selected.
    requestAnimationFrame(() => {
      document.getElementById(`${windowId}-tab-${target.id}`)?.focus();
    });
  }

  /** The URL a tab should produce. Render is omitted rather than written as
   * lens=render: it is the default, and a link with no lens must keep
   * meaning "the default lens" so old links stay valid.
   *
   * net is carried through from the current URL: this replaces the whole
   * search string, so anything not named here is dropped. */
  function searchForTab(tab: { packagePath: string; renderPath: string; lens: RealmLens }) {
    return (previous: Record<string, unknown>) => {
      const net = typeof previous.net === "string" ? { net: previous.net } : {};
      if (tab.packagePath === "") return net;
      return {
        ...net,
        pkg: tab.packagePath,
        ...(tab.renderPath ? { path: tab.renderPath } : {}),
        ...(tab.lens === "render" ? {} : { lens: tab.lens }),
      };
    };
  }

  function selectTab(tabId: string) {
    setActiveTab(windowId, tabId);
    if (!isPrimary) return;
    const tab = win!.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    void router.navigate({
      to: "/",
      search: searchForTab(tab),
    });
  }

  return (
    <div className="realm-browser">
      <div className="realm-browser__chrome">
        {/* Only real tabs live inside the tablist. "New tab" and "pop out"
            are actions, not tabs — having them in here made the tablist
            structurally invalid (flagged by Lighthouse) and put them in the
            arrow-key cycle where they don't belong. */}
        <div className="realm-browser__tabstrip">
          <div
            className="realm-browser__tabstrip-tabs"
            role="tablist"
            aria-label="Open realms"
            onKeyDown={onTabKeyDown}
          >
            {win.tabs.map((t) => {
              const selected = t.id === win.activeTabId;
              return (
                <span
                  key={t.id}
                  className="realm-browser__tabstrip-item"
                  data-active={selected}
                >
                  <button
                    type="button"
                    role="tab"
                    id={`${windowId}-tab-${t.id}`}
                    aria-selected={selected}
                    aria-controls={`${windowId}-tabpanel`}
                    // Roving tabindex: Tab reaches the tabstrip once, then
                    // arrow keys move between tabs — the standard pattern,
                    // instead of Tab stopping on every open realm.
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectTab(t.id)}
                  >
                    {t.packagePath === "" ? "🏠 Home" : formatRealmLabel(t.packagePath, 18)}
                  </button>
                  {win.tabs.length > 1 && (
                    <button
                      type="button"
                      className="realm-browser__tab-close"
                      aria-label="Close tab"
                      tabIndex={selected ? 0 : -1}
                      onClick={() => closeTab(windowId, t.id)}
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
          </div>
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
      <div
        id={`${windowId}-tabpanel`}
        role="tabpanel"
        aria-labelledby={`${windowId}-tab-${activeTab.id}`}
        className="realm-browser__tabpanel"
      >
        <RealmTabBody windowId={windowId} tab={activeTab} />
      </div>
    </div>
  );
}

function RealmUrlBar({ windowId, tab }: { windowId: string; tab: RealmTab }) {
  const [draftPackagePath, setDraftPackagePath] = useState(tab.packagePath);
  const [focused, setFocused] = useState(false);
  const hasPackage = tab.packagePath !== "";
  const suggestions = useRealmSuggestions(focused, draftPackagePath);

  // The SAME query the Render lens uses, not a parallel one. This only
  // needs to know whether the committed path resolves, and must know it
  // regardless of which lens tab is showing — but it was a second query key
  // for an identical request, so opening a realm on Render fetched it twice
  // (AUD-026). Sharing the key means react-query serves both from one call.
  const { isFetching, isError } = useRealmRender(tab.packagePath, tab.renderPath, hasPackage);
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
        <Combobox
          listLabel="Realm suggestions"
          value={draftPackagePath}
          onChange={setDraftPackagePath}
          // Taking a suggestion is the whole intent — no reason to make
          // someone press Open afterwards.
          onSelect={(option) => openPackage(option.value)}
          options={suggestions.map((s) => ({
            value: s.packagePath,
            // What #197 was about. The full path is committed and shown as
            // the hint; the label middle-elides the `g1…` namespace, which is
            // the part that pushed the package name — the part that actually
            // identifies the realm — off the right edge.
            label: smartTruncateRealmPath(s.packagePath, 34),
            hint: s.label === s.packagePath ? undefined : s.label,
          }))}
          inputProps={{
            autoCorrect: "off",
            autoCapitalize: "off",
            spellCheck: false,
            "data-1p-ignore": "true",
            "data-lpignore": "true",
            "data-bwignore": "true",
            "data-status": status,
            onFocus: () => setFocused(true),
            onBlur: () => setFocused(false),
            placeholder: "gno.land/r/sys/names",
          }}
        />
      </label>
      <button type="submit">Open</button>
      <button
        type="button"
        disabled={!hasPackage}
        onClick={() => openInRealmTab(windowId, { packagePath: "" })}
      >
        🏠 Home
      </button>
      <FavoriteToggle packagePath={tab.packagePath} />
      <ShareLinkButton label={tab.packagePath === "" ? "this view" : tab.packagePath} />
    </form>
  );
}

/** The star. Renders nothing until the stored list has been read — an
 * unstarred star on a realm you starred last week is a lie, and it appears
 * for only as long as IndexedDB takes to answer. */
function FavoriteToggle({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const { favorites, hydrated, networkId } = useFavorites();
  if (packagePath === "" || !hydrated) return null;

  const isFavorite = favorites.some((f) => f.refUri === favoriteUri(networkId, packagePath));
  const label = `${isFavorite ? "Remove" : "Add"} ${packagePath} ${isFavorite ? "from" : "to"} favorites`;

  return (
    <button
      type="button"
      className="realm-browser__favorite"
      aria-pressed={isFavorite}
      aria-label={label}
      title={label}
      onClick={() => void toggleFavorite(sdk, networkId, packagePath, formatRealmLabel(packagePath, 40))}
    >
      {isFavorite ? "★" : "☆"}
    </button>
  );
}

interface RenderStats {
  updatedAt: number;
  loadMs: number;
  refetch: () => void;
  isFetching: boolean;
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
          <SourceExplorer packagePath={tab.packagePath} windowId={windowId} />
        ) : tab.lens === "docs" ? (
          <RealmDocs packagePath={tab.packagePath} />
        ) : tab.lens === "state-explorer" ? (
          <RealmStateExplorer packagePath={tab.packagePath} />
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

  /** Switching lens also updates the URL for the primary window, so the
   * address bar is a link to what is actually on screen. Popped-out windows
   * do not own the URL, so they only update their own state. */
  function selectLens(lens: RealmLens) {
    updateActiveTab(windowId, { lens });
    if (windowId !== "realm" || tab.packagePath === "") return;
    void router.navigate({
      to: "/",
      search: (previous: Record<string, unknown>) => ({
        ...(typeof previous.net === "string" ? { net: previous.net } : {}),
        pkg: tab.packagePath,
        ...(tab.renderPath ? { path: tab.renderPath } : {}),
        ...(lens === "render" ? {} : { lens }),
      }),
    });
  }

  // A manual refresh often re-fetches identical content (e.g. a realm whose
  // Render() output hasn't changed since the last load) — with only the
  // spinner and a "Updated just now" label that read the same before and
  // after, clicking refresh looked like it did nothing at all. This flag
  // gives an unmistakable, un-missable confirmation that the click was
  // received and the round trip actually completed.
  const [justRefreshed, setJustRefreshed] = useState(false);
  const wasFetchingRef = useRef(false);
  const manualRefreshRef = useRef(false);
  useEffect(() => {
    const isFetching = renderStats?.isFetching ?? false;
    const wasFetching = wasFetchingRef.current;
    wasFetchingRef.current = isFetching;
    if (wasFetching && !isFetching && manualRefreshRef.current) {
      manualRefreshRef.current = false;
      setJustRefreshed(true);
      const timer = setTimeout(() => setJustRefreshed(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [renderStats?.isFetching]);

  const packageHasNoRender = useNoRenderStore((s) => s.packagesWithNoRender.has(tab.packagePath));

  const items: LensTabBarItem[] = [
    ...LENS_TABS.map((lensTab) => ({
      key: lensTab.id,
      label: lensTab.label,
      active: tab.lens === lensTab.id,
      disabled: lensTab.id === "render" && packageHasNoRender,
      onClick: () => selectLens(lensTab.id),
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
            {justRefreshed ? (
              <span className="realm-browser__refreshed-badge">✓ Refreshed</span>
            ) : (
              <Freshness dataUpdatedAt={renderStats.updatedAt} />
            )}
            <button
              type="button"
              className="realm-browser__refresh"
              data-spinning={renderStats.isFetching}
              disabled={renderStats.isFetching}
              aria-label="Refresh"
              title="Refresh"
              onClick={() => {
                manualRefreshRef.current = true;
                renderStats.refetch();
              }}
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

  const { data, error, isPending, isFetching, dataUpdatedAt, refetch } = useRealmRender(
    packagePath,
    renderPath
  );

  // Watches the events this realm emits and refetches when it changes, so the
  // view stops silently showing state the chain has moved past (#90).
  const { change, acknowledge } = useRealmChangeWatch(packagePath, !error);

  useEffect(() => {
    if (!data) return;
    onStats?.({ updatedAt: dataUpdatedAt, loadMs: data.loadMs, refetch: () => void refetch(), isFetching });
  }, [data, dataUpdatedAt, onStats, refetch, isFetching]);

  // A package with no Render() function at all (a pure library p/ package,
  // or an r/ realm that just never defined one) always fails this query the
  // same way, with the VM error type "/vm.NoRenderDeclError". The adapter
  // surfaces that as a typed error, so this is an instanceof rather than a
  // substring match on the message — the message is not an API, and a
  // reworded one used to silently disable this whole behaviour.
  // Rather than showing it as a generic error
  // (there's nothing to "retry"), mark it so the lens tab bar can gray out
  // Render, and jump straight to Source, which always works.
  useEffect(() => {
    if (!(error instanceof NoRenderDeclError)) return;
    useNoRenderStore.getState().markNoRender(packagePath);
    useRealmTabsStore.getState().updateActiveTab(windowId, { lens: "source" });
  }, [error, packagePath, windowId]);

  if (error) {
    if (error instanceof NoRenderDeclError) return null;
    return (
      <ErrorState message="Could not load this realm" error={error} onRetry={() => void refetch()} />
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
      {/* Keyed on the height so a second change re-triggers the animation
          rather than leaving a badge that has already stopped moving. */}
      {change && (
        <ChangeBadge key={change.height} change={change} onDismiss={acknowledge} />
      )}
      {data.nodes.map((node, i) => (
        <RenderNodeView key={i} node={node} windowId={windowId} />
      ))}
    </article>
  );
}

/** "Changed at block #N" — a block height, not "just now".
 *
 * A wall-clock time would be this browser's opinion; the height is what every
 * observer of the chain agrees on, which is the whole point being
 * demonstrated. Dismissible, and it never covers the content: an announcement
 * that has to be dismissed before you can read what it is announcing would be
 * worse than no announcement. */
function ChangeBadge({ change, onDismiss }: { change: RealmChange; onDismiss: () => void }) {
  return (
    <div className="realm-change-badge" role="status">
      <span className="realm-change-badge__dot" aria-hidden="true" />
      <span>
        Changed at block #{formatNumber(change.height)}
        {change.eventType ? ` · ${change.eventType}` : ""}
        {change.count > 1 ? ` · ${change.count} events` : ""}
      </span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss this change notice">
        ×
      </button>
    </div>
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

// Now that the indexer's GraphQL endpoint sends real CORS headers
// (confirmed live 2026-07-25 — see rpc/src/indexer.ts), "Recently deployed"
// is backed by a real, complete listing (sdk.indexer.listRealms) rather
// than only what's been seen since this window opened. Networks with no
// indexer configured (e.g. gnodev) still fall back to the old vm/qpaths
// polling approach (use-recently-added-packages.ts).
function useIndexerRealms(indexerConfigured: boolean) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  return useQuery({
    queryKey: ["indexer-realms", networkId],
    queryFn: async () => (await sdk.indexer.listRealms()).data,
    enabled: indexerConfigured,
  });
}

/** Absent rather than empty when you have no favorites.
 *
 * An empty "Favorites" heading above four populated sections reads as
 * something broken, and the star on the toolbar is where the feature is
 * discovered — not a placeholder here. */
function FavoritesSection({ onOpen }: { onOpen: (packagePath: string) => void }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const favorites = useFavoriteRealms();
  if (favorites.length === 0) return null;

  return (
    <CollapsibleSection id="favorites" title={`★ Favorites (${favorites.length})`}>
      <ul className="realm-browser-home__list">
        {favorites.map((favorite) => (
          <li key={favorite.packagePath}>
            <button type="button" onClick={() => onOpen(favorite.packagePath)}>
              {favorite.label}
              <span className="realm-browser-home__path">{favorite.packagePath}</span>
            </button>
            <button
              type="button"
              className="realm-browser-home__unfavorite"
              aria-label={`Remove ${favorite.packagePath} from favorites`}
              title="Remove from favorites"
              onClick={() =>
                void toggleFavorite(sdk, networkId, favorite.packagePath, favorite.label)
              }
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );
}

function RealmBrowserHome({ onOpen }: { onOpen: (packagePath: string, renderPath?: string) => void }) {
  const sdk = useSdk();
  const indexerConfigured = !!sdk.networks.getActive().indexerGraphqlUrl;
  const { events } = useLiveEvents(false);
  const activity = rankByActivity(events);
  const recentlyAddedPolled = useRecentlyAddedPackages(!indexerConfigured);
  const {
    data: indexerRealms,
    error: indexerError,
    isPending: indexerPending,
    refetch: refetchIndexerRealms,
  } = useIndexerRealms(indexerConfigured);
  const staffPicks = KNOWN_REALMS.filter((r) => !r.system);
  const systemRealms = KNOWN_REALMS.filter((r) => r.system);

  return (
    <div className="realm-browser-home">
      {/* First, above the chain-derived lists. Everything else here is
          what the chain happens to be doing; this is the one section you
          chose, and it was useless sitting under two long feeds. */}
      <FavoritesSection onOpen={onOpen} />

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

      <CollapsibleSection id="recently-added" title="Recently deployed">
        {indexerConfigured ? (
          indexerError ? (
            <ErrorState
              message="Could not load recently deployed realms" error={indexerError}
              onRetry={() => void refetchIndexerRealms()}
            />
          ) : indexerPending ? (
            <p className="state-line" aria-busy="true">
              Loading recently deployed realms…
            </p>
          ) : (
            <ul className="realm-browser-home__list">
              {indexerRealms!.map((realm) => (
                <li key={realm.packagePath}>
                  <button type="button" onClick={() => onOpen(realm.packagePath)}>
                    {realm.packagePath}
                    <span className="realm-browser-home__path">block #{formatNumber(realm.blockHeight)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : recentlyAddedPolled.length === 0 ? (
          <p className="state-line" aria-busy="true">
            Watching for newly deployed packages…
          </p>
        ) : (
          <ul className="realm-browser-home__list">
            {recentlyAddedPolled.map((path) => (
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
