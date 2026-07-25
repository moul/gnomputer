import { useSdk } from "../sdk-context";
import { focusOrReopen } from "./open-ref";
import { openGnockpitEmbed } from "./open-gnockpit-embed";

const CHAIN_APPS: { id: string; icon: string; label: string }[] = [
  { id: "network-monitor", icon: "📡", label: "Network Monitor" },
  { id: "validator-monitor", icon: "🛡️", label: "Validator Monitor" },
  { id: "block-explorer", icon: "🧱", label: "Blocks" },
  { id: "event-explorer", icon: "🔔", label: "Event Explorer" },
  { id: "chain-stats", icon: "⛽", label: "Chain Stats" },
];

export function IslandChainMenu() {
  const sdk = useSdk();
  const gnockpitUrl = sdk.networks.getActive().gnockpitUrl;

  return (
    <div className="island-menu">
      <p className="island-menu__title">Chain</p>
      <ul className="island-menu__list">
        {CHAIN_APPS.map((app) => (
          <li key={app.id}>
            <button type="button" onClick={() => focusOrReopen(app.id)}>
              <span aria-hidden="true">{app.icon}</span>
              {app.label}
            </button>
          </li>
        ))}
        <li>
          {/* Opens the real embedded Gnockpit dashboard directly, not the
              native mini-summary page (gnockpit.tsx) that itself has its
              own button to reach the embed — one click, not two, since
              that's genuinely all this menu entry is for. Falls back to
              the mini page (which explains "no Gnockpit configured")
              when this network has none. */}
          <button
            type="button"
            onClick={() => (gnockpitUrl ? openGnockpitEmbed(gnockpitUrl) : focusOrReopen("gnockpit"))}
          >
            <span aria-hidden="true">📊</span>
            Gnockpit
          </button>
        </li>
      </ul>
    </div>
  );
}
