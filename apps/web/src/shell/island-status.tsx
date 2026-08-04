import { useSdk } from "../sdk-context";
import { useChainHeight } from "../use-chain-height";
import { useWalletStore } from "./wallet-store";
import { useLiveUpdatesStore } from "./live-updates-store";
import { useOnlineStatus } from "./use-online-status";

/** Network, height and identity, in the chrome rather than behind a menu.
 *
 * The island was icons and a clock. Which chain you were on, whether it was
 * keeping up, and who you were acting as all lived inside popovers — so the
 * single most important piece of context for reading anything on screen
 * ("this is Topaz, at this height, as a guest") was invisible until you went
 * looking (AUD-011).
 *
 * Deliberately compact and text-only: the island is dense and that is the
 * point of it. Below 900px the network name and identity drop away and only
 * the height is kept, since that is the part that changes.
 */
export function IslandStatus() {
  const sdk = useSdk();
  const network = sdk.networks.getActive();
  const { height } = useChainHeight();
  const account = useWalletStore((s) => s.account);
  const lowData = useLiveUpdatesStore((s) => s.lowData);
  const online = useOnlineStatus();

  return (
    <div className="island__status">
      <span className="island__status-item island__status-item--network" title={network.rpcUrl}>
        <span className="visually-hidden">Network: </span>
        {network.name}
      </span>
      <span className="island__status-item island__status-item--height">
        <span className="visually-hidden">Block height: </span>
        {height === null ? "—" : `#${height.toLocaleString()}`}
      </span>
      {/* Offline wins over low-data in the badge: one of them the user chose
          and can undo, the other happened to them. Saying "Low data" to
          someone in a tunnel would be answering a question they did not
          ask. */}
      {!online ? (
        <span className="island__status-item island__status-badge" data-kind="offline" title="No network — showing what was already loaded, and will catch up when you reconnect">
          Offline
        </span>
      ) : lowData ? (
        <span className="island__status-item island__status-badge" data-kind="low-data" title="Live updates paused to save data. Nothing is polling the chain.">
          Paused
        </span>
      ) : null}
      <span className="island__status-item island__status-item--identity">
        <span className="visually-hidden">Signed in as: </span>
        {account ? shortAddress(account.address) : "Guest"}
      </span>
    </div>
  );
}

function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
