import { useSearch } from "@tanstack/react-router";
import { RealmBrowser } from "./realm-browser";
import { RecentBlocks } from "./recent-blocks";
import { NetworkMonitor } from "./network-monitor";
import { ValidatorMonitor } from "./validator-monitor";
import { BlockExplorer } from "./block-explorer";
import { Window } from "../shell/window";
import { Taskbar } from "../shell/taskbar";
import { SettingsWindow } from "../shell/settings-window";
import { HistoryWindow } from "../shell/history-window";
import { AddressWindow } from "../shell/address-window";
import { ExtraRealmWindows } from "../shell/extra-realm-windows";
import { useWindowPersistence } from "../shell/use-window-persistence";

const WINDOW_ACCENTS: Record<string, string> = {
  realm: "cyan",
  "recent-blocks": "magenta",
  "network-monitor": "green",
  "validator-monitor": "blue",
  "block-explorer": "red",
  settings: "magenta",
  history: "green",
  address: "amber",
};

export function Home() {
  // Bumped to v3 when Source merged into the Realm Browser window as a lens
  // tab instead of its own window — a v2 persisted layout would still carry
  // a "source" entry that no longer corresponds to anything rendered.
  useWindowPersistence("window-layout:home:v3");
  const search = useSearch({ strict: false }) as { pkg?: string; path?: string };
  const packagePath = search.pkg ?? "";
  const renderPath = search.path ?? "";

  const realmTitle =
    packagePath === ""
      ? "Realm Browser"
      : renderPath
        ? `Realm Browser · ${packagePath} · ${renderPath}`
        : `Realm Browser · ${packagePath}`;

  return (
    <div className="home-layout">
      <div className="desktop-shell">
        <div className="desktop">
          <Window
            id="realm"
            title={realmTitle}
            accent="cyan"
            defaultGeometry={{ x: 0, y: 0, width: 460, height: 340 }}
          >
            <RealmBrowser windowId="realm" packagePath={packagePath} renderPath={renderPath} />
          </Window>
          <Window
            id="recent-blocks"
            title="Recent Blocks"
            accent="magenta"
            defaultGeometry={{ x: 476, y: 0, width: 380, height: 340 }}
          >
            <RecentBlocks />
          </Window>
          <Window
            id="network-monitor"
            title="Network Monitor"
            accent="green"
            defaultGeometry={{ x: 872, y: 0, width: 380, height: 340 }}
          >
            <NetworkMonitor />
          </Window>
          <Window
            id="validator-monitor"
            title="Validator Monitor"
            accent="blue"
            defaultGeometry={{ x: 0, y: 356, width: 380, height: 300 }}
          >
            <ValidatorMonitor />
          </Window>
          <Window
            id="block-explorer"
            title="Block Explorer"
            accent="red"
            defaultGeometry={{ x: 396, y: 356, width: 380, height: 300 }}
          >
            <BlockExplorer />
          </Window>
          <SettingsWindow />
          <HistoryWindow />
          <AddressWindow />
          <ExtraRealmWindows />
        </div>
        <Taskbar accents={WINDOW_ACCENTS} />
      </div>
    </div>
  );
}
