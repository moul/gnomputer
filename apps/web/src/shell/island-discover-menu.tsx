import { DISCOVER_TABS } from "../routes/discover";
import { openDiscoverTab } from "./open-discover";
import { openExplorer } from "./open-explorer";
import { useSdk } from "../sdk-context";

// Faucet Hub covers every gno.land faucet (Topaz, Boards2 Mobile, ...) from
// one shared page — confirmed live (lists "Topaz Faucet" among others). No
// per-network URL needed, unlike explorerUrl/gnockpitUrl, since it's one
// community-run hub rather than a per-deployment tool. Opens externally
// rather than in a dedicated window — it's a one-off "go do this on the
// real site" action, not a tool worth keeping embedded/pinned open like
// the Explorer or Gnockpit windows.
const FAUCET_HUB_URL = "https://faucet.gno.land";

export function IslandDiscoverMenu() {
  const sdk = useSdk();
  const explorerUrl = sdk.networks.getActive().explorerUrl;

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
      <button
        type="button"
        className="island-menu__action"
        onClick={() => window.open(FAUCET_HUB_URL, "_blank", "noopener,noreferrer")}
      >
        🚰 Faucet ↗
      </button>
      {explorerUrl && (
        <button
          type="button"
          className="island-menu__action"
          onClick={() => openExplorer(explorerUrl)}
        >
          🧭 Explorer →
        </button>
      )}
    </div>
  );
}
