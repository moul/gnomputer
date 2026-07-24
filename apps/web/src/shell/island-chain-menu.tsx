import { focusOrReopen } from "./open-ref";

const CHAIN_APPS: { id: string; icon: string; label: string }[] = [
  { id: "network-monitor", icon: "📡", label: "Network Monitor" },
  { id: "validator-monitor", icon: "🛡️", label: "Validator Monitor" },
  { id: "block-explorer", icon: "🧱", label: "Blocks" },
  { id: "event-explorer", icon: "🔔", label: "Event Explorer" },
  { id: "gnockpit", icon: "📊", label: "Gnockpit" },
];

export function IslandChainMenu() {
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
      </ul>
    </div>
  );
}
