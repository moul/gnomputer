import { Suspense, lazy, type ReactNode } from "react";
import { useSearch } from "@tanstack/react-router";
import type { RealmLens } from "../shell/realm-tabs-store";
import { RealmBrowser } from "./realm-browser";
import { Window } from "../shell/window";
import { SettingsWindow } from "../shell/settings-window";
import { HistoryWindow } from "../shell/history-window";
import { AddressWindow } from "../shell/address-window";
import { ExplorerWindow } from "../shell/explorer-window";
import { GnockpitEmbedWindow } from "../shell/gnockpit-embed-window";
import { ExtraRealmWindows } from "../shell/extra-realm-windows";
import { useWindowPersistence } from "../shell/use-window-persistence";
import { useWindowViewportReclamp } from "../shell/use-window-viewport-reclamp";
import { useWindowStore } from "../shell/window-store";

// Every one of these apps starts closed, and <Window> returns null before
// rendering its children — so with static imports their code still shipped
// in the eager entry chunk and was parsed on boot for windows the user may
// never open. Lazy means an app's code is fetched the first time its window
// is actually opened (AUD-037). RealmBrowser is deliberately NOT lazy: it is
// the one window open by default, so lazying it would only add a flash of
// the fallback on every boot.
const Users = lazy(() => import("./users").then((x) => ({ default: x.Users })));
const DiscoverPackages = lazy(() => import("./discover-packages").then((x) => ({ default: x.DiscoverPackages })));
const TransactionExplorer = lazy(() => import("./transaction-explorer").then((x) => ({ default: x.TransactionExplorer })));
const DiscoverTokens = lazy(() => import("./discover-tokens").then((x) => ({ default: x.DiscoverTokens })));
const DiscoverGovernance = lazy(() => import("./discover-governance").then((x) => ({ default: x.DiscoverGovernance })));
const NetworkMonitor = lazy(() => import("./network-monitor").then((x) => ({ default: x.NetworkMonitor })));
const ValidatorMonitor = lazy(() => import("./validator-monitor").then((x) => ({ default: x.ValidatorMonitor })));
const BlockExplorer = lazy(() => import("./block-explorer").then((x) => ({ default: x.BlockExplorer })));
const EventExplorer = lazy(() => import("./event-explorer").then((x) => ({ default: x.EventExplorer })));
const ChainStats = lazy(() => import("./chain-stats").then((x) => ({ default: x.ChainStats })));
const Gnockpit = lazy(() => import("./gnockpit").then((x) => ({ default: x.Gnockpit })));
const Resources = lazy(() => import("./resources").then((x) => ({ default: x.Resources })));
const Editor = lazy(() => import("./editor").then((x) => ({ default: x.Editor })));
const ShellApp = lazy(() => import("./shell-app").then((x) => ({ default: x.ShellApp })));

/** Windows are already framed chrome, so a lazy app only needs a quiet
 * placeholder inside that frame while its chunk loads. */
function LazyApp({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="state-line" aria-busy="true">Loading…</p>}>{children}</Suspense>
  );
}

export function Home() {
  // Bumped to v9 when Discover's shared-tab window was split into five
  // fully independent windows ("discover" id retired, "users"/"packages"/
  // "transactions"/"tokens"/"governance" added) — bumping the key is what
  // makes that visible to existing visitors too, since ensureWindow()
  // otherwise never touches a window id that's already in a restored
  // layout (saved positions/sizes always win over a new default).
  useWindowPersistence("window-layout:home:v9");
  useWindowViewportReclamp();
  const overviewOpen = useWindowStore((s) => s.overviewOpen);
  const toggleOverview = useWindowStore((s) => s.toggleOverview);
  const search = useSearch({ strict: false }) as {
    pkg?: string;
    path?: string;
    lens?: RealmLens;
  };
  const packagePath = search.pkg ?? "";
  const renderPath = search.path ?? "";

  const realmTitle =
    packagePath === ""
      ? "Browser"
      : renderPath
        ? `Browser · ${packagePath} · ${renderPath}`
        : `Browser · ${packagePath}`;

  return (
    <div className="home-layout">
      <div className="desktop-shell">
        <div
          className="desktop"
          data-overview={overviewOpen}
          onPointerDown={(e) => {
            // pointerdown, not click — a window clicked while in overview
            // mode relocates (snaps back to its real position) between
            // pointerdown and click, so by the time click fires the cursor
            // may be sitting over bare desktop instead of the window,
            // making e.target === e.currentTarget true here again and
            // reopening overview a beat after the window closed it.
            // pointerdown fires before that relocation, so target hit-
            // testing here still reflects what was actually under the
            // cursor when the user pressed down.
            if (e.target === e.currentTarget) toggleOverview();
          }}
        >
          <Window
            id="realm"
            title={realmTitle}
            accent="cyan"
            centeredPlacement
            defaultGeometry={{ x: 0, y: 0, width: 960, height: 700 }}
          >
            <RealmBrowser
              windowId="realm"
              packagePath={packagePath}
              renderPath={renderPath}
              lens={search.lens}
            />
          </Window>
          <Window
            id="users"
            title="Users"
            accent="amber"
            startClosed
            defaultGeometry={{ x: 180, y: 140, width: 520, height: 480 }}
          >
            <LazyApp>
              <Users />
            </LazyApp>
          </Window>
          <Window
            id="packages"
            title="Packages"
            accent="amber"
            startClosed
            defaultGeometry={{ x: 200, y: 150, width: 560, height: 480 }}
          >
            <LazyApp>
              <DiscoverPackages />
            </LazyApp>
          </Window>
          <Window
            id="transactions"
            title="Transactions"
            accent="amber"
            startClosed
            defaultGeometry={{ x: 220, y: 160, width: 720, height: 500 }}
          >
            <LazyApp>
              <TransactionExplorer />
            </LazyApp>
          </Window>
          <Window
            id="tokens"
            title="Tokens"
            accent="amber"
            startClosed
            defaultGeometry={{ x: 240, y: 170, width: 560, height: 480 }}
          >
            <LazyApp>
              <DiscoverTokens />
            </LazyApp>
          </Window>
          <Window
            id="governance"
            title="Governance"
            accent="amber"
            startClosed
            defaultGeometry={{ x: 260, y: 180, width: 600, height: 500 }}
          >
            <LazyApp>
              <DiscoverGovernance />
            </LazyApp>
          </Window>
          <Window
            id="resources"
            title="Resources"
            accent="amber"
            startClosed
            defaultGeometry={{ x: 220, y: 160, width: 640, height: 500 }}
          >
            <LazyApp>
              <Resources />
            </LazyApp>
          </Window>
          <Window
            id="editor"
            title="Editor"
            accent="magenta"
            startClosed
            defaultGeometry={{ x: 260, y: 190, width: 720, height: 540 }}
          >
            <LazyApp>
              <Editor />
            </LazyApp>
          </Window>
          <Window
            id="shell"
            title="Shell"
            accent="green"
            startClosed
            defaultGeometry={{ x: 300, y: 220, width: 640, height: 420 }}
          >
            <LazyApp>
              <ShellApp />
            </LazyApp>
          </Window>
          <Window
            id="network-monitor"
            title="Network Monitor"
            accent="green"
            startClosed
            defaultGeometry={{ x: 476, y: 0, width: 460, height: 400 }}
          >
            <LazyApp>
              <NetworkMonitor />
            </LazyApp>
          </Window>
          <Window
            id="validator-monitor"
            title="Validator Monitor"
            accent="blue"
            startClosed
            defaultGeometry={{ x: 0, y: 356, width: 460, height: 360 }}
          >
            <LazyApp>
              <ValidatorMonitor />
            </LazyApp>
          </Window>
          <Window
            id="block-explorer"
            title="Block Explorer"
            accent="red"
            startClosed
            defaultGeometry={{ x: 396, y: 356, width: 720, height: 460 }}
          >
            <LazyApp>
              <BlockExplorer />
            </LazyApp>
          </Window>
          <Window
            id="event-explorer"
            title="Event Explorer"
            accent="blue"
            startClosed
            defaultGeometry={{ x: 120, y: 100, width: 600, height: 460 }}
          >
            <LazyApp>
              <EventExplorer />
            </LazyApp>
          </Window>
          <Window
            id="chain-stats"
            title="Chain Stats"
            accent="green"
            startClosed
            defaultGeometry={{ x: 140, y: 110, width: 480, height: 520 }}
          >
            <LazyApp>
              <ChainStats />
            </LazyApp>
          </Window>
          <Window
            id="gnockpit"
            title="Gnockpit"
            accent="green"
            startClosed
            defaultGeometry={{ x: 160, y: 130, width: 480, height: 380 }}
          >
            <LazyApp>
              <Gnockpit />
            </LazyApp>
          </Window>
          <SettingsWindow />
          <HistoryWindow />
          <AddressWindow />
          <ExplorerWindow />
          <GnockpitEmbedWindow />
          <ExtraRealmWindows />
        </div>
      </div>
    </div>
  );
}
