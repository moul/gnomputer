import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";

export function TopBar() {
  const sdk = useSdk();
  const { activeNetworkId, guestLabel, setActiveNetwork, setCommandPaletteOpen } = useShellStore();

  return (
    <header className="top-bar" role="banner">
      <span className="top-bar__brand">Gnomputer</span>
      <label className="top-bar__network">
        Network
        <select
          value={activeNetworkId}
          onChange={(e) => {
            sdk.networks.setActive(e.target.value);
            setActiveNetwork(e.target.value);
          }}
        >
          {sdk.networks.list().map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        aria-label="Open command palette (Cmd+K)"
      >
        Search…
      </button>
      <span className="top-bar__guest">{guestLabel}</span>
    </header>
  );
}
