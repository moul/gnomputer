import { useEffect, useState } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { RealmBrowser } from "./realm-browser";
import { SourceExplorer } from "./source-explorer";
import { RecentActivity } from "./recent-activity";
import { NetworkMonitor } from "./network-monitor";
import { ValidatorMonitor } from "./validator-monitor";
import { TrailBreadcrumb } from "../shell/trail-breadcrumb";
import { Window } from "../shell/window";
import { WindowDock } from "../shell/window-dock";
import { useWindowPersistence } from "../shell/use-window-persistence";

const FEATURED_PACKAGE = "gno.land/r/sys/users";

export function Home() {
  useWindowPersistence("window-layout:home");
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

      <div className="desktop">
        <Window
          id="realm"
          title={realmTitle}
          accent="cyan"
          defaultGeometry={{ x: 24, y: 24, width: 520, height: 480 }}
        >
          <RealmBrowser packagePath={packagePath} renderPath={renderPath} />
        </Window>
        <Window
          id="source"
          title={`Source · ${packagePath}`}
          accent="amber"
          defaultGeometry={{ x: 568, y: 24, width: 560, height: 480 }}
        >
          <SourceExplorer packagePath={packagePath} />
        </Window>
        <Window
          id="activity"
          title="Recent activity"
          accent="magenta"
          defaultGeometry={{ x: 24, y: 528, width: 1104, height: 220 }}
        >
          <RecentActivity />
        </Window>
        <Window
          id="network-monitor"
          title="Network Monitor"
          accent="green"
          defaultGeometry={{ x: 24, y: 772, width: 340, height: 260 }}
        >
          <NetworkMonitor />
        </Window>
        <Window
          id="validator-monitor"
          title="Validator Monitor"
          accent="cyan"
          defaultGeometry={{ x: 380, y: 772, width: 748, height: 260 }}
        >
          <ValidatorMonitor />
        </Window>
      </div>
      <WindowDock />
    </div>
  );
}
