import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { useNetworkStatus } from "./use-network-status";
import { NetworkMonitor } from "../routes/network-monitor";

const STATE_LABEL: Record<string, string> = {
  connecting: "Connecting…",
  connected: "Connected",
  error: "Not reachable",
};

export function SettingsNetworkTab() {
  const sdk = useSdk();
  const { activeNetworkId, setActiveNetwork } = useShellStore();
  const { state, network } = useNetworkStatus();

  const links: { label: string; url: string }[] = [
    { label: "RPC", url: network.rpcUrl },
    { label: "gnoweb", url: network.gnowebUrl ?? "" },
    { label: "tx-indexer", url: network.indexerGraphqlUrl ?? "" },
    { label: "gnockpit", url: network.gnockpitUrl ?? "" },
    { label: "Explorer", url: network.explorerUrl ?? "" },
  ].filter((link) => link.url !== "");

  return (
    <div className="settings-tab">
      <label className="settings-field">
        Active network
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
      <p className="settings-field__status" data-state={state}>
        <span className="status-dot" data-state={state} aria-hidden="true" />
        {STATE_LABEL[state]}
      </p>
      <NetworkMonitor />
      <div>
        <p className="settings-section-label">Known links</p>
        <ul className="settings-network-links">
          {links.map((link) => (
            <li key={link.label}>
              <span className="settings-network-links__label">{link.label}</span>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.url}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
