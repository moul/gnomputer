import type { GnomputerSDK, NetworkConfig } from "@gnomputer/app-sdk";
import { useShellStore } from "../store";
import { useCustomNetworksStore } from "./custom-networks-store";

/** Every network that can be switched to: the built-ins plus anything the
 * user added. Custom networks are not tracked inside the SDK, so the two
 * lists have to be joined at the call site — doing it here keeps the
 * Settings picker and the island switcher offering the same set. */
export function listSelectableNetworks(sdk: GnomputerSDK): NetworkConfig[] {
  return [...sdk.networks.list(), ...useCustomNetworksStore.getState().networks];
}

/**
 * Switches the active network.
 *
 * Both halves are required and easy to half-do: the SDK holds the config every
 * query is built from, and the shell store holds the id that gets persisted
 * and rendered. Setting only the store would leave queries pointed at the old
 * chain under the new chain's name.
 * @param {GnomputerSDK} sdk the SDK whose active config to repoint
 * @param {NetworkConfig} config the network to switch to
 */
export function activateNetwork(sdk: GnomputerSDK, config: NetworkConfig): void {
  if (useShellStore.getState().activeNetworkId === config.id) return;
  sdk.networks.setActiveConfig(config);
  useShellStore.getState().setActiveNetwork(config.id);
  // Announced separately from the id itself, which also moves while the app
  // settles at startup. Only this call means "someone chose another chain".
  useShellStore.getState().noteNetworkSwitch();
}
