import { Suspense, lazy } from "react";
import { Window } from "./window";
import { useSettingsUiStore } from "./settings-store";
import { useTrailRecorder } from "../use-trail-recorder";
import { SETTINGS_TABS, TAB_LABEL } from "./settings-tabs";

export { SETTINGS_TABS } from "./settings-tabs";

/** One lazy chunk per panel, with the window frame and tab strip staying
 * eager.
 *
 * The seven panels together were ~17KB gzipped of the main chunk, paid for by
 * every first visit whether or not Settings was ever opened. They could not be
 * split before because the island's Settings dropdown imported the tab list
 * from this module and dragged the panels along with it; that list now lives
 * in settings-tabs.ts.
 *
 * Per panel rather than one Settings chunk, because only one is ever on
 * screen: opening Theme should not also fetch the changelog.
 *
 * The FRAME is deliberately not lazy. Every other lazy app here puts its
 * Suspense boundary inside an eager <Window> (routes/home.tsx), and a first
 * attempt at this wrapped the whole component instead — so #window-settings
 * did not exist at all until the chunk arrived. An e2e caught it under load.
 * A window's id, geometry and open/closed state are shell concerns; deferring
 * them makes the window briefly absent rather than briefly empty.
 */
const PANELS = {
  network: lazy(() =>
    import("./settings-network-tab").then((m) => ({ default: m.SettingsNetworkTab }))
  ),
  user: lazy(() => import("./settings-user-tab").then((m) => ({ default: m.SettingsUserTab }))),
  theme: lazy(() => import("./settings-theme-tab").then((m) => ({ default: m.SettingsThemeTab }))),
  storage: lazy(() =>
    import("./settings-storage-tab").then((m) => ({ default: m.SettingsStorageTab }))
  ),
  about: lazy(() => import("./settings-about-tab").then((m) => ({ default: m.SettingsAboutTab }))),
  bug: lazy(() => import("./settings-bug-tab").then((m) => ({ default: m.SettingsBugTab }))),
  changelog: lazy(() =>
    import("./settings-changelog-tab").then((m) => ({ default: m.SettingsChangelogTab }))
  ),
} as const;

export function SettingsWindow() {
  const activeTab = useSettingsUiStore((s) => s.activeTab);
  const setActiveTab = useSettingsUiStore((s) => s.setActiveTab);
  const Panel = PANELS[activeTab];

  useTrailRecorder({
    uri: `gno://_/settings/${activeTab}`,
    label: `Settings › ${TAB_LABEL[activeTab]}`,
  });

  return (
    <Window
      id="settings"
      title="Settings"
      accent="magenta"
      startClosed
      defaultGeometry={{ x: 60, y: 60, width: 420, height: 420 }}
    >
      <div className="settings-window">
        <div className="window-tabbar" role="tablist" aria-label="Settings sections">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className="window-tab"
              data-active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>
        <div className="window-tabbody">
          <Suspense
            fallback={
              <p className="state-line" aria-busy="true">
                Loading…
              </p>
            }
          >
            <Panel />
          </Suspense>
        </div>
      </div>
    </Window>
  );
}
