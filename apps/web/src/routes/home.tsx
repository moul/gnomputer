import { useEffect, useState } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { RealmBrowser } from "./realm-browser";
import { SourceExplorer } from "./source-explorer";
import { RecentActivity } from "./recent-activity";
import { NetworkMonitor } from "./network-monitor";
import { ValidatorMonitor } from "./validator-monitor";
import { BlockExplorer } from "./block-explorer";
import { TrailBreadcrumb } from "../shell/trail-breadcrumb";
import { Window } from "../shell/window";
import { Taskbar } from "../shell/taskbar";
import { useWindowPersistence } from "../shell/use-window-persistence";

const FEATURED_PACKAGE = "gno.land/r/sys/users";

const WINDOW_ACCENTS: Record<string, string> = {
  realm: "cyan",
  source: "amber",
  activity: "magenta",
  "network-monitor": "green",
  "validator-monitor": "blue",
  "block-explorer": "red",
};

export function Home() {
  // Bumped to v2 when the default layout moved from a tall single-column stack
  // to a compact 3x2 grid — a v1 persisted layout would otherwise silently
  // restore the old cramped positions for anyone who'd already opened the app.
  useWindowPersistence("window-layout:home:v2");
  const search = useSearch({ strict: false }) as { pkg?: string; path?: string };
  const navigate = useNavigate();
  const packagePath = search.pkg ?? FEATURED_PACKAGE;
  const renderPath = search.path ?? "";
  const [draftPackagePath, setDraftPackagePath] = useState(packagePath);

  useEffect(() => {
    setDraftPackagePath(packagePath);
  }, [packagePath]);

  const realmTitle = renderPath
    ? `Experience · ${packagePath} · ${renderPath}`
    : `Experience · ${packagePath}`;

  return (
    <div className="home-layout">
      <div className="home-toolbar">
        <p className="home-lede home-lede--primary">You are browsing the shared computer.</p>
        <p className="home-lede">
          Open any program, user, function or transaction to follow it through the world.
        </p>
        <TrailBreadcrumb />
        <form
          className="open-package-form"
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({ to: "/", search: { pkg: draftPackagePath } });
          }}
        >
          <label>
            Open a package path
            <input
              value={draftPackagePath}
              onChange={(e) => setDraftPackagePath(e.target.value)}
              placeholder="gno.land/r/sys/names"
            />
          </label>
          <button type="submit">Open</button>
        </form>
      </div>

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
        </div>
        <Taskbar accents={WINDOW_ACCENTS} />
      </div>
    </div>
  );
}
