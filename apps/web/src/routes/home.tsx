import { useSearch } from "@tanstack/react-router";
import { RealmBrowser } from "./realm-browser";
import { Discover } from "./discover";
import { NetworkMonitor } from "./network-monitor";
import { ValidatorMonitor } from "./validator-monitor";
import { BlockExplorer } from "./block-explorer";
import { EventExplorer } from "./event-explorer";
import { ChainStats } from "./chain-stats";
import { Gnockpit } from "./gnockpit";
import { Resources } from "./resources";
import { Editor } from "./editor";
import { ShellApp } from "./shell-app";
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

export function Home() {
  // Bumped to v8 when Users became a Discover tab instead of its own
  // window ("users" id retired, "discover" added) — bumping the key is
  // what makes that visible to existing visitors too, since ensureWindow()
  // otherwise never touches a window id that's already in a restored
  // layout (saved positions/sizes always win over a new default).
  useWindowPersistence("window-layout:home:v8");
  useWindowViewportReclamp();
  const overviewOpen = useWindowStore((s) => s.overviewOpen);
  const toggleOverview = useWindowStore((s) => s.toggleOverview);
  const search = useSearch({ strict: false }) as { pkg?: string; path?: string };
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
            defaultGeometry={{ x: 0, y: 0, width: 960, height: 700 }}
          >
            <RealmBrowser windowId="realm" packagePath={packagePath} renderPath={renderPath} />
          </Window>
          <Window
            id="discover"
            title="Discover"
            accent="amber"
            startClosed
            defaultGeometry={{ x: 180, y: 140, width: 640, height: 480 }}
          >
            <Discover />
          </Window>
          <Window
            id="resources"
            title="Resources"
            accent="amber"
            startClosed
            defaultGeometry={{ x: 220, y: 160, width: 640, height: 500 }}
          >
            <Resources />
          </Window>
          <Window
            id="editor"
            title="Editor"
            accent="magenta"
            startClosed
            defaultGeometry={{ x: 260, y: 190, width: 720, height: 540 }}
          >
            <Editor />
          </Window>
          <Window
            id="shell"
            title="Shell"
            accent="green"
            startClosed
            defaultGeometry={{ x: 300, y: 220, width: 640, height: 420 }}
          >
            <ShellApp />
          </Window>
          <Window
            id="network-monitor"
            title="Network Monitor"
            accent="green"
            startClosed
            defaultGeometry={{ x: 476, y: 0, width: 460, height: 400 }}
          >
            <NetworkMonitor />
          </Window>
          <Window
            id="validator-monitor"
            title="Validator Monitor"
            accent="blue"
            startClosed
            defaultGeometry={{ x: 0, y: 356, width: 460, height: 360 }}
          >
            <ValidatorMonitor />
          </Window>
          <Window
            id="block-explorer"
            title="Block Explorer"
            accent="red"
            startClosed
            defaultGeometry={{ x: 396, y: 356, width: 720, height: 460 }}
          >
            <BlockExplorer />
          </Window>
          <Window
            id="event-explorer"
            title="Event Explorer"
            accent="blue"
            startClosed
            defaultGeometry={{ x: 120, y: 100, width: 600, height: 460 }}
          >
            <EventExplorer />
          </Window>
          <Window
            id="chain-stats"
            title="Chain Stats"
            accent="green"
            startClosed
            defaultGeometry={{ x: 140, y: 110, width: 480, height: 520 }}
          >
            <ChainStats />
          </Window>
          <Window
            id="gnockpit"
            title="Gnockpit"
            accent="green"
            startClosed
            defaultGeometry={{ x: 160, y: 130, width: 480, height: 380 }}
          >
            <Gnockpit />
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
