import { networkShortName } from "@gnomputer/app-sdk";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { useCustomNetworksStore } from "./custom-networks-store";
import { activateNetwork } from "./activate-network";
import { focusOrReopen } from "./open-ref";

/** Switches chain from the island, where the current one is already shown.
 *
 * Which chain you are on is the most consequential thing on screen — it
 * decides what every realm path, address and height means — and changing it
 * used to mean opening Settings and finding the Network tab. Reading it and
 * changing it now live in the same place. */
export function IslandNetworkMenu() {
  const sdk = useSdk();
  const activeNetworkId = useShellStore((s) => s.activeNetworkId);
  const customNetworks = useCustomNetworksStore((s) => s.networks);
  const networks = [...sdk.networks.list(), ...customNetworks];

  return (
    <div className="island-menu">
      <p className="island-menu__title">Network</p>
      <ul className="island-menu__list">
        {networks.map((network) => {
          const active = network.id === activeNetworkId;
          return (
            <li key={network.id}>
              <button
                type="button"
                data-active={active}
                // The full name carries the qualifier the label drops, and
                // the RPC host is what actually distinguishes two networks
                // that happen to share a display name.
                title={`${network.name} — ${network.rpcUrl}`}
                onClick={() => activateNetwork(sdk, network)}
              >
                {/* Filled for the current network, hollow otherwise — the
                    colour identifies which chain, the fill says whether it is
                    the active one. Colour alone would carry neither meaning
                    for anyone who cannot separate these hues. */}
                <span
                  className="network-dot"
                  data-active={active}
                  style={network.color ? { color: network.color } : undefined}
                  aria-hidden="true"
                />
                {networkShortName(network)}
                {active && <span className="visually-hidden"> (current)</span>}
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={() => focusOrReopen("settings")}>
            <span aria-hidden="true">⚙️</span>
            Network settings…
          </button>
        </li>
      </ul>
    </div>
  );
}
