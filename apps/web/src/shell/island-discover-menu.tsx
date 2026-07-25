import { focusOrReopen } from "./open-ref";
import { openExplorer } from "./open-explorer";
import { useSdk } from "../sdk-context";

// Discover isn't a real app of its own — each of these is a genuinely
// independent app/window (app-registry.ts, hiddenFromIsland: true), just
// grouped here as a hover-only dropdown since there's no reason each one
// needs its own island icon too. Same emoji as each window's own icon.
const DISCOVER_ITEMS: { id: string; emoji: string; label: string }[] = [
  { id: "users", emoji: "👤", label: "Users" },
  { id: "packages", emoji: "📦", label: "Packages" },
  { id: "transactions", emoji: "🧾", label: "Transactions" },
  { id: "tokens", emoji: "🪙", label: "Tokens" },
  { id: "governance", emoji: "🏛️", label: "Governance" },
];

export const DISCOVER_WINDOW_IDS = DISCOVER_ITEMS.map((item) => item.id);

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
      {DISCOVER_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className="island-menu__action"
          onClick={() => focusOrReopen(item.id)}
        >
          {item.emoji} {item.label} →
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
