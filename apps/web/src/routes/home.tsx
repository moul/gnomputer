import { useSearch } from "@tanstack/react-router";
import { RealmBrowser } from "./realm-browser";
import { WorldExplorer } from "./world-explorer";
import { Users } from "./users";
import { NetworkMonitor } from "./network-monitor";
import { ValidatorMonitor } from "./validator-monitor";
import { BlockExplorer } from "./block-explorer";
import { EventExplorer } from "./event-explorer";
import { Gnockpit } from "./gnockpit";
import { Window } from "../shell/window";
import { SettingsWindow } from "../shell/settings-window";
import { HistoryWindow } from "../shell/history-window";
import { AddressWindow } from "../shell/address-window";
import { ExtraRealmWindows } from "../shell/extra-realm-windows";
import { useWindowPersistence } from "../shell/use-window-persistence";
import { useWindowStore } from "../shell/window-store";

export function Home() {
  // Bumped to v5 when every app but Browser switched to startClosed by
  // default (the island bar is now the discovery mechanism — apps open on
  // click instead of cluttering the desktop from boot) and window position
  // on first-ever creation became randomized. A v4 persisted layout is
  // unaffected either way (saved positions/closed-state always win), this
  // is purely about what a brand-new visitor sees.
  useWindowPersistence("window-layout:home:v5");
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
          onClick={(e) => {
            if (e.target === e.currentTarget) toggleOverview();
          }}
        >
          {overviewOpen && (
            <p className="desktop__overview-hint">Overview · click a window to open it</p>
          )}
          <Window
            id="realm"
            title={realmTitle}
            accent="cyan"
            defaultGeometry={{ x: 0, y: 0, width: 460, height: 340 }}
          >
            <RealmBrowser windowId="realm" packagePath={packagePath} renderPath={renderPath} />
          </Window>
          <Window
            id="world-explorer"
            title="World Explorer"
            accent="cyan"
            startClosed
            defaultGeometry={{ x: 140, y: 110, width: 420, height: 380 }}
          >
            <WorldExplorer />
          </Window>
          <Window
            id="users"
            title="Users"
            accent="amber"
            startClosed
            defaultGeometry={{ x: 180, y: 140, width: 400, height: 340 }}
          >
            <Users />
          </Window>
          <Window
            id="network-monitor"
            title="Network Monitor"
            accent="green"
            startClosed
            defaultGeometry={{ x: 476, y: 0, width: 380, height: 340 }}
          >
            <NetworkMonitor />
          </Window>
          <Window
            id="validator-monitor"
            title="Validator Monitor"
            accent="blue"
            startClosed
            defaultGeometry={{ x: 0, y: 356, width: 380, height: 300 }}
          >
            <ValidatorMonitor />
          </Window>
          <Window
            id="block-explorer"
            title="Block Explorer"
            accent="red"
            startClosed
            defaultGeometry={{ x: 396, y: 356, width: 560, height: 340 }}
          >
            <BlockExplorer />
          </Window>
          <Window
            id="event-explorer"
            title="Event Explorer"
            accent="blue"
            startClosed
            defaultGeometry={{ x: 120, y: 100, width: 480, height: 400 }}
          >
            <EventExplorer />
          </Window>
          <Window
            id="gnockpit"
            title="Gnockpit"
            accent="green"
            startClosed
            defaultGeometry={{ x: 160, y: 130, width: 380, height: 320 }}
          >
            <Gnockpit />
          </Window>
          <SettingsWindow />
          <HistoryWindow />
          <AddressWindow />
          <ExtraRealmWindows />
        </div>
      </div>
    </div>
  );
}
