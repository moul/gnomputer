import type { GnomputerSDK, NetworkConfig } from "@gnomputer/app-sdk";
import { useShellStore } from "../store";
import { useCustomNetworksStore } from "./custom-networks-store";
import { useAddressWindowStore } from "./address-window-store";
import { usePendingRefsStore } from "./pending-refs-store";
import { useWindowStore } from "./window-store";

/** Every network that can be switched to: the built-ins plus anything the
 * user added. Custom networks are not tracked inside the SDK, so the two
 * lists have to be joined at the call site — doing it here keeps the
 * Settings picker and the island switcher offering the same set. */
export function listSelectableNetworks(sdk: GnomputerSDK): NetworkConfig[] {
  return [...sdk.networks.list(), ...useCustomNetworksStore.getState().networks];
}

/** The open window with the highest zIndex — what the user is looking at. */
function frontmostWindowId(): string | null {
  const windows = useWindowStore.getState().windows;
  let front: string | null = null;
  let topZ = -Infinity;
  for (const [id, win] of Object.entries(windows)) {
    if (win.closed || win.zIndex <= topZ) continue;
    topZ = win.zIndex;
    front = id;
  }
  return front;
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

  // Raised before anything moves, so the overlay is already covering the
  // desktop by the time it is torn down and rebuilt.
  useShellStore.getState().setNetworkSwitching(true);

  // Content keyed to the old chain. An address and a block height are only
  // meaningful on the chain they were read from, and these two stores are
  // what the Address and Block windows reopen onto.
  useAddressWindowStore.setState({ currentAddress: null });
  usePendingRefsStore.setState({ pendingBlockHeight: null });

  // Remembered before the desktop is replaced. Switching from inside a window
  // — the network picker lives in Settings — would otherwise close the very
  // window being used, because the incoming chain's desktop does not have it.
  useShellStore.getState().setCarryWindowId(frontmostWindowId());

  sdk.networks.setActiveConfig(config);
  useShellStore.getState().setActiveNetwork(config.id);
  // Announced separately from the id itself, which also moves while the app
  // settles at startup. Only this call means "someone chose another chain".
  useShellStore.getState().noteNetworkSwitch();
}
