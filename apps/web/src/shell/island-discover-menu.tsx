import { DISCOVER_TABS } from "../routes/discover";
import { openDiscoverTab } from "./open-discover";

export function IslandDiscoverMenu() {
  return (
    <div className="island-menu">
      <p className="island-menu__title">Discover</p>
      {DISCOVER_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="island-menu__action"
          onClick={() => openDiscoverTab(tab.id)}
        >
          {tab.emoji} {tab.label} →
        </button>
      ))}
    </div>
  );
}
