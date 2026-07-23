import { Window } from "./window";
import { useSettingsUiStore, type SettingsTab } from "./settings-store";
import { SettingsNetworkTab } from "./settings-network-tab";
import { SettingsUserTab } from "./settings-user-tab";
import { SettingsAboutTab } from "./settings-about-tab";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "network", label: "Network" },
  { id: "user", label: "User" },
  { id: "about", label: "About" },
];

export function SettingsWindow() {
  const activeTab = useSettingsUiStore((s) => s.activeTab);
  const setActiveTab = useSettingsUiStore((s) => s.setActiveTab);

  return (
    <Window
      id="settings"
      title="Settings"
      accent="magenta"
      startClosed
      defaultGeometry={{ x: 60, y: 60, width: 420, height: 420 }}
    >
      <div className="settings-window">
        <div className="settings-window__tabs" role="tablist" aria-label="Settings sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className="settings-window__tab"
              data-active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="settings-window__body">
          {activeTab === "network" && <SettingsNetworkTab />}
          {activeTab === "user" && <SettingsUserTab />}
          {activeTab === "about" && <SettingsAboutTab />}
        </div>
      </div>
    </Window>
  );
}
