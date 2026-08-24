import { useState } from "react";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { useNetworkStatus } from "./use-network-status";
import { useCustomNetworksStore, buildCustomNetworkConfig } from "./custom-networks-store";
import { probeNetwork, isLocalEndpoint } from "./probe-network";
import { activateNetwork } from "./activate-network";
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
  const customNetworks = useCustomNetworksStore((s) => s.networks);
  const addCustomNetwork = useCustomNetworksStore((s) => s.addNetwork);
  const removeCustomNetwork = useCustomNetworksStore((s) => s.removeNetwork);
  const [nameDraft, setNameDraft] = useState("");
  const [rpcUrlDraft, setRpcUrlDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  const allNetworks = [...sdk.networks.list(), ...customNetworks];

  const links: { label: string; url: string }[] = [
    { label: "RPC", url: network.rpcUrl },
    { label: "gnoweb", url: network.gnowebUrl ?? "" },
    { label: "tx-indexer", url: network.indexerGraphqlUrl ?? "" },
    { label: "gnockpit", url: network.gnockpitUrl ?? "" },
    { label: "Explorer", url: network.explorerUrl ?? "" },
  ].filter((link) => link.url !== "");

  function activate(id: string) {
    const config = allNetworks.find((n) => n.id === id);
    if (!config) return;
    activateNetwork(sdk, config);
  }

  async function addNetwork(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    let url: URL;
    try {
      url = new URL(rpcUrlDraft.trim());
    } catch {
      setAddError("That doesn't look like a valid URL.");
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      setAddError("The RPC URL must be http:// or https://.");
      return;
    }
    if (nameDraft.trim() === "") {
      setAddError("Give it a name.");
      return;
    }
    if (allNetworks.some((n) => n.id === buildCustomNetworkConfig(nameDraft, "http://x").id)) {
      setAddError("A network with that name already exists.");
      return;
    }

    // Probe BEFORE saving. Saving an endpoint that turns out to be
    // unreachable, CORS-blocked, or not an RPC at all leaves the app on a
    // network it cannot use, with no explanation of which of those it was.
    setProbing(true);
    const probe = await probeNetwork(rpcUrlDraft.trim());
    setProbing(false);
    if (!probe.ok) {
      setAddError(probe.message);
      return;
    }

    const config = buildCustomNetworkConfig(nameDraft, rpcUrlDraft.trim(), probe.chainId);
    addCustomNetwork(config);
    // Not activate(config.id) — allNetworks is a snapshot from this render,
    // taken before addCustomNetwork's state update is visible, so a lookup
    // by id would find nothing yet. config is already the full object.
    sdk.networks.setActiveConfig(config);
    setActiveNetwork(config.id);
    setNameDraft("");
    setRpcUrlDraft("");
  }

  function removeNetwork(id: string) {
    removeCustomNetwork(id);
    if (activeNetworkId === id) activate(sdk.networks.getDefault().id);
  }

  return (
    <div className="settings-tab">
      <label className="settings-field">
        Active network
        <select value={activeNetworkId} onChange={(e) => activate(e.target.value)}>
          {allNetworks.map((n) => (
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
      {customNetworks.length > 0 && (
        <div>
          <p className="settings-section-label">Custom networks</p>
          <ul className="settings-network-links">
            {customNetworks.map((n) => (
              <li key={n.id}>
                <span className="settings-network-links__label">
                  {n.name}
                  {isLocalEndpoint(n.rpcUrl) && (
                    <span className="custom-network__tag" title="This endpoint is on your own machine">
                      local
                    </span>
                  )}
                </span>
                <span className="custom-network__rpc-url">
                  {n.rpcUrl}
                  <span className="custom-network__chain-id">
                    {n.chainId === "unknown" ? "chain ID unknown" : `chain ${n.chainId}`}
                  </span>
                </span>
                <button type="button" onClick={() => removeNetwork(n.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form className="custom-network-form" onSubmit={(e) => void addNetwork(e)}>
        <p className="settings-section-label">Add a custom network</p>
        <label>
          Name
          <input
            type="text"
            autoComplete="off"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="My local gnodev"
          />
        </label>
        <label>
          RPC URL
          <input
            type="text"
            autoComplete="off"
            value={rpcUrlDraft}
            onChange={(e) => setRpcUrlDraft(e.target.value)}
            placeholder="http://127.0.0.1:26657"
          />
        </label>
        <button type="submit" disabled={probing || !nameDraft.trim() || !rpcUrlDraft.trim()}>
          {probing ? "Checking the endpoint…" : "Check and add"}
        </button>
        <p className="custom-network-form__note">
          The endpoint is checked before it is saved, and its chain ID is read from it rather
          than assumed. A remote endpoint must be <code>https://</code> and must allow requests
          from this page; <code>http://</code> works only for localhost.
        </p>
        {addError && (
          <p className="state-line" role="alert" data-error="true">
            {addError}
          </p>
        )}
      </form>
    </div>
  );
}
