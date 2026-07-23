import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { Linkified } from "../shell/linkify";
import { Freshness } from "../shell/freshness";
import { useRealmTabsStore, type RealmLens, type RealmTab } from "../shell/realm-tabs-store";
import { openInRealmTab } from "../shell/open-in-realm-tab";
import { gnowebRealmUrl } from "../shell/gnoweb-links";
import { router } from "../routes/root";
import { SourceExplorer } from "./source-explorer";
import type { RenderNode } from "@gnomputer/lenses";

const STAFF_PICKS = [
  { label: "Users", packagePath: "gno.land/r/sys/users" },
  { label: "Boards2", packagePath: "gno.land/r/gnoland/boards2" },
  { label: "Blog", packagePath: "gno.land/r/gnoland/blog" },
  { label: "GovDAO", packagePath: "gno.land/r/gov/dao" },
];

const LENS_TABS: { id: RealmLens; label: string }[] = [
  { id: "render", label: "Render" },
  { id: "source", label: "Source" },
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
      <div className="realm-browser__tabstrip" role="tablist" aria-label="Open realms">
        {win.tabs.map((t) => (
          <span
            key={t.id}
            className="realm-browser__tabstrip-item"
            data-active={t.id === win.activeTabId}
          >
            <button type="button" onClick={() => selectTab(t.id)}>
              {t.packagePath === "" ? "🏠 Home" : t.packagePath}
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
      <RealmTabContent windowId={windowId} tab={activeTab} />
    </div>
  );
}

function RealmTabContent({ windowId, tab }: { windowId: string; tab: RealmTab }) {
  const sdk = useSdk();
  const updateActiveTab = useRealmTabsStore((s) => s.updateActiveTab);
  const [draftPackagePath, setDraftPackagePath] = useState(tab.packagePath);
  const hasPackage = tab.packagePath !== "";
  const gnowebUrl = sdk.networks.getActive().gnowebUrl;

  useEffect(() => {
    setDraftPackagePath(tab.packagePath);
  }, [tab.packagePath]);

  function openPackage(pkg: string) {
    openInRealmTab(windowId, { packagePath: pkg });
  }

  return (
    <>
      <form
        className="open-package-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (draftPackagePath === "") return;
          openPackage(draftPackagePath);
        }}
      >
        <label>
          Realm path
          <input
            value={draftPackagePath}
            onChange={(e) => setDraftPackagePath(e.target.value)}
            placeholder="gno.land/r/sys/names"
          />
        </label>
        <button type="submit">Open</button>
        {hasPackage && (
          <button type="button" onClick={() => openInRealmTab(windowId, { packagePath: "" })}>
            🏠 Home
          </button>
        )}
        {hasPackage && gnowebUrl && (
          <a
            className="realm-browser__gnoweb-link"
            href={gnowebRealmUrl(gnowebUrl, tab.packagePath, tab.renderPath || undefined)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on gnoweb ↗
          </a>
        )}
      </form>
      {!hasPackage ? (
        <RealmBrowserHome onOpen={openPackage} />
      ) : (
        <>
          <div className="realm-browser__tabs" role="tablist" aria-label="Realm view">
            {LENS_TABS.map((lensTab) => (
              <button
                key={lensTab.id}
                type="button"
                role="tab"
                aria-selected={tab.lens === lensTab.id}
                data-active={tab.lens === lensTab.id}
                className="realm-browser__tab"
                onClick={() => updateActiveTab(windowId, { lens: lensTab.id })}
              >
                {lensTab.label}
              </button>
            ))}
          </div>
          <div className="realm-browser__lens-body">
            {tab.lens === "render" ? (
              <RealmRenderView windowId={windowId} packagePath={tab.packagePath} renderPath={tab.renderPath} />
            ) : (
              <SourceExplorer packagePath={tab.packagePath} />
            )}
          </div>
        </>
      )}
    </>
  );
}

function RealmRenderView({
  windowId,
  packagePath,
  renderPath,
}: {
  windowId: string;
  packagePath: string;
  renderPath: string;
}) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  const trailLabel = renderPath ? `${packagePath} (${renderPath})` : packagePath;
  useTrailRecorder({
    uri: `gno://${networkId}/realm/${packagePath}${renderPath ? `#${renderPath}` : ""}`,
    label: trailLabel,
  });

  const {
    data: nodes,
    error,
    isPending,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["realm-render", networkId, packagePath, renderPath],
    queryFn: async () => {
      const env = await sdk.rpc.queryRender(packagePath, renderPath, new Date().toISOString());
      return sdk.lenses.parseRender(env.data, packagePath);
    },
  });

  if (error) {
    return (
      <p className="state-line" role="alert">
        Could not load this realm: {error.message}
      </p>
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
    <>
      <Freshness dataUpdatedAt={dataUpdatedAt} />
      <article aria-label={`Realm ${packagePath}`}>
        {nodes.map((node, i) => (
          <RenderNodeView key={i} node={node} windowId={windowId} />
        ))}
      </article>
    </>
  );
}

function RealmBrowserHome({ onOpen }: { onOpen: (packagePath: string) => void }) {
  const sdk = useSdk();
  const {
    data: realms,
    error,
    isPending,
  } = useQuery({
    queryKey: ["realm-list", sdk.networks.getActive().id],
    queryFn: async () => (await sdk.indexer.listRealms()).data,
    retry: false,
  });

  return (
    <div className="realm-browser-home">
      <section>
        <h3>Staff picks</h3>
        <ul className="realm-browser-home__list">
          {STAFF_PICKS.map((pick) => (
            <li key={pick.packagePath}>
              <button type="button" onClick={() => onOpen(pick.packagePath)}>
                {pick.label}
                <span className="realm-browser-home__path">{pick.packagePath}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Community realms</h3>
        {error ? (
          <p className="state-line" role="alert">
            Realm discovery isn't reachable from the browser on this network right now — the
            indexer doesn't allow direct browser access yet. Try Staff Picks above, or open a
            realm path directly.
          </p>
        ) : isPending ? (
          <p className="state-line" aria-busy="true">
            Discovering deployed realms…
          </p>
        ) : realms.length === 0 ? (
          <p className="state-line">No other realms discovered on this network yet.</p>
        ) : (
          <ul className="realm-browser-home__list">
            {realms.map((realm) => (
              <li key={realm.packagePath}>
                <button type="button" onClick={() => onOpen(realm.packagePath)}>
                  {realm.packagePath}
                  <span className="realm-browser-home__path">deployed at #{realm.blockHeight}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
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
