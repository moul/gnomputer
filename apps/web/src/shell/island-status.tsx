import { useEffect, useState } from "react";
import { networkShortName } from "@gnomputer/app-sdk";
import { useSdk } from "../sdk-context";
import { useChainHeight, CHAIN_HEIGHT_POLL_MS } from "../use-chain-height";
import { formatTimeAgo } from "../format-time-ago";
import { IslandPopover } from "./island-popover";
import { IslandNetworkMenu } from "./island-network-menu";
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
  const { height, dataUpdatedAt } = useChainHeight();
  const account = useWalletStore((s) => s.account);
  const lowData = useLiveUpdatesStore((s) => s.lowData);
  const online = useOnlineStatus();
  const now = useNow(!online || lowData ? null : HEIGHT_STALE_TICK_MS);

  // The height is the app's single load-bearing "is this live?" signal, and it
  // used to lie. `useChainHeight` reports success for as long as it holds data,
  // so a poll failing for twenty minutes still rendered a confident number
  // while the Network Monitor next to it correctly warned "Updated 20m ago".
  // Reproduced by getting rate-limited by a public RPC: every request failing,
  // `navigator.onLine` still true (the browser is fine, the chain is not), the
  // clock still saying "connected".
  //
  // Suppressed when offline or paused, because both of those already have a
  // badge saying so — a second warning for a state the user chose, or is
  // already told about, is noise.
  const heightStale =
    online &&
    !lowData &&
    height !== null &&
    dataUpdatedAt > 0 &&
    now - dataUpdatedAt > HEIGHT_STALE_MS;

  return (
    <div className="island__status">
      <IslandPopover
        align="left"
        trigger={
          <button
            type="button"
            className="island__status-item island__status-item--network"
            // The qualifier ("official testnet") is dropped from the label —
            // it is the same for most entries, so it costs width without
            // telling them apart. Kept in the tooltip alongside the RPC host.
            title={`${network.name} — ${network.rpcUrl}`}
          >
            <span className="visually-hidden">Network: </span>
            <span
              className="network-dot"
              data-active="true"
              style={network.color ? { color: network.color } : undefined}
              aria-hidden="true"
            />
            {networkShortName(network)}
          </button>
        }
      >
        <IslandNetworkMenu />
      </IslandPopover>
      <span
        className="island__status-item island__status-item--height"
        data-stale={heightStale || undefined}
        title={
          heightStale
            ? `The chain has not answered since ${formatTimeAgo(new Date(dataUpdatedAt).toISOString())} — this height is the last one it gave, not the current one.`
            : undefined
        }
      >
        <span className="visually-hidden">Block height: </span>
        {heightStale && <span className="visually-hidden">last known, not current: </span>}
        {height === null ? "—" : `#${height.toLocaleString()}`}
        {heightStale && (
          <span className="island__status-item--height-stale" aria-hidden="true">
            {" "}
            ⚠
          </span>
        )}
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

/** How long the tip height may go unrefreshed before it is called out.
 *
 * The poll runs every 4s, so this is roughly seven missed attempts — long
 * enough that a slow response or one dropped request says nothing, short
 * enough that a dead endpoint is not reported as live for minutes. Deliberately
 * far tighter than Freshness's five-minute rule: that one guards values which
 * legitimately change rarely, while a chain tip that has not moved in half a
 * minute is news. */
const HEIGHT_STALE_MS = 30_000;

/** Re-render cadence while watching for staleness. Half the poll interval, so
 * the warning appears within one poll of becoming true rather than up to a
 * whole extra period late. */
const HEIGHT_STALE_TICK_MS = CHAIN_HEIGHT_POLL_MS / 2;

/** A clock that ticks only while there is something to notice.
 *
 * `intervalMs` of null stops it entirely — offline and paused both suppress the
 * warning, and a timer running to recompute a value that cannot change is the
 * kind of thing that keeps a phone awake for nothing. */
function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs === null) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
