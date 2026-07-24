import { Window } from "./window";
import { useSettingsUiStore, type SettingsTab } from "./settings-store";
import { SettingsNetworkTab } from "./settings-network-tab";
import { SettingsUserTab } from "./settings-user-tab";
import { SettingsThemeTab } from "./settings-theme-tab";
import { SettingsAboutTab } from "./settings-about-tab";
import { SettingsBugTab } from "./settings-bug-tab";
import { SettingsChangelogTab } from "./settings-changelog-tab";
import { useTrailRecorder } from "../use-trail-recorder";

// Single source of truth for a tab's emoji + label — the island Settings
// dropdown (island-settings-menu.tsx) mirrors this list so every dropdown
// entry matches its in-window tab exactly, one entry each, no duplicates.
export const SETTINGS_TABS: { id: SettingsTab; emoji: string; label: string }[] = [
  { id: "network", emoji: "📡", label: "Network" },
  { id: "user", emoji: "👤", label: "User" },
  { id: "theme", emoji: "🎨", label: "Theme" },
  { id: "about", emoji: "ℹ️", label: "About" },
  { id: "bug", emoji: "🐛", label: "Report a bug" },
  { id: "changelog", emoji: "📜", label: "Changelog" },
];

const TAB_LABEL: Record<SettingsTab, string> = Object.fromEntries(
  SETTINGS_TABS.map((t) => [t.id, t.label]),
) as Record<SettingsTab, string>;

export function SettingsWindow() {
  const activeTab = useSettingsUiStore((s) => s.activeTab);
  const setActiveTab = useSettingsUiStore((s) => s.setActiveTab);

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
          {activeTab === "network" && <SettingsNetworkTab />}
          {activeTab === "user" && <SettingsUserTab />}
          {activeTab === "theme" && <SettingsThemeTab />}
          {activeTab === "about" && <SettingsAboutTab />}
          {activeTab === "bug" && <SettingsBugTab />}
          {activeTab === "changelog" && <SettingsChangelogTab />}
        </div>
      </div>
    </Window>
  );
}
