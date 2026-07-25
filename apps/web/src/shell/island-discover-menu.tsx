import { DISCOVER_TABS } from "../routes/discover";
import { openDiscoverTab } from "./open-discover";
import { openEmbed } from "./open-embed";
import { useSdk } from "../sdk-context";

// Faucet Hub covers every gno.land faucet (Topaz, Boards2 Mobile, ...) from
// one shared page — confirmed live (lists "Topaz Faucet" among others) and
// embeddable (no X-Frame-Options/CSP framing block, same check as
// mygnoscan/Gnockpit). No per-network URL needed, unlike explorerUrl/
// gnockpitUrl, since it's one community-run hub rather than a
// per-deployment tool.
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
        onClick={() => openEmbed(FAUCET_HUB_URL, "Faucet")}
      >
        🚰 Faucet →
      </button>
      {explorerUrl && (
        <button
          type="button"
          className="island-menu__action"
          onClick={() => openEmbed(explorerUrl, "Explorer")}
        >
          🔭 Explorer →
        </button>
      )}
    </div>
  );
}
