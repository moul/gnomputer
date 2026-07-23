import { useSearch } from "@tanstack/react-router";
import { RealmBrowser } from "./realm-browser";
import { SourceExplorer } from "./source-explorer";
import { RecentActivity } from "./recent-activity";
import { NetworkMonitor } from "./network-monitor";
import { ValidatorMonitor } from "./validator-monitor";
import { BlockExplorer } from "./block-explorer";
import { Window } from "../shell/window";
import { Taskbar } from "../shell/taskbar";
import { SettingsWindow } from "../shell/settings-window";
import { HistoryWindow } from "../shell/history-window";
import { useWindowPersistence } from "../shell/use-window-persistence";

const FEATURED_PACKAGE = "gno.land/r/sys/users";

const WINDOW_ACCENTS: Record<string, string> = {
  realm: "cyan",
  source: "amber",
  activity: "magenta",
  "network-monitor": "green",
  "validator-monitor": "blue",
  "block-explorer": "red",
  settings: "magenta",
  history: "green",
};

export function Home() {
  // Bumped to v2 when the default layout moved from a tall single-column stack
  // to a compact 3x2 grid — a v1 persisted layout would otherwise silently
  // restore the old cramped positions for anyone who'd already opened the app.
  useWindowPersistence("window-layout:home:v2");
  const search = useSearch({ strict: false }) as { pkg?: string; path?: string };
  const packagePath = search.pkg ?? FEATURED_PACKAGE;
  const renderPath = search.path ?? "";

  const realmTitle = renderPath
    ? `Experience · ${packagePath} · ${renderPath}`
    : `Experience · ${packagePath}`;

  return (
    <div className="home-layout">
      <div className="desktop-shell">
        <div className="desktop">
          <Window
            id="realm"
            title={realmTitle}
            accent="cyan"
            defaultGeometry={{ x: 0, y: 0, width: 380, height: 300 }}
          >
            <RealmBrowser packagePath={packagePath} renderPath={renderPath} />
          </Window>
          <Window
            id="source"
            title={`Source · ${packagePath}`}
            accent="amber"
            defaultGeometry={{ x: 396, y: 0, width: 380, height: 300 }}
          >
            <SourceExplorer packagePath={packagePath} />
          </Window>
          <Window
            id="activity"
            title="Recent activity"
            accent="magenta"
            defaultGeometry={{ x: 792, y: 0, width: 380, height: 300 }}
          >
            <RecentActivity />
          </Window>
          <Window
            id="network-monitor"
            title="Network Monitor"
            accent="green"
            defaultGeometry={{ x: 0, y: 316, width: 380, height: 300 }}
          >
            <NetworkMonitor />
          </Window>
          <Window
            id="validator-monitor"
            title="Validator Monitor"
            accent="blue"
            defaultGeometry={{ x: 396, y: 316, width: 380, height: 300 }}
          >
            <ValidatorMonitor />
          </Window>
          <Window
            id="block-explorer"
            title="Block Explorer"
            accent="red"
            defaultGeometry={{ x: 792, y: 316, width: 380, height: 300 }}
          >
            <BlockExplorer />
          </Window>
          <SettingsWindow />
          <HistoryWindow />
        </div>
        <Taskbar accents={WINDOW_ACCENTS} />
      </div>
    </div>
  );
}
