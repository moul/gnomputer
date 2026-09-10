export interface PathActivity {
  /** The most recent height at which this package was called, or emitted an
   * event of its own, within the window that was scanned. */
  lastHeight: number;
  /** Transactions in the scanned window that called this package. Zero is a
   * real answer: a package can show up only through its events. */
  callCount: number;
}

export interface ActivityScan {
  byPath: Map<string, PathActivity>;
  /** The oldest height either source reached, or null if neither returned
   * anything.
   *
   * Reported rather than inferred because it is the honest bound on "no recent
   * activity": both sources are windowed, so absence means "not in the last N
   * blocks", never "never". Any copy that says otherwise is lying.
   */
  oldestScanned: number | null;
}

/**
 * When each package was last touched, from the two windowed sources the app
 * already fetches.
 *
 * BOTH are needed, and each covers the other's blind spot — this is the whole
 * reason the naive versions of this feature were wrong:
 *
 * - Events alone miss a package whose calls emit nothing of their own.
 *   `r/gnops/valopers` on Pearl had 83 direct calls and zero events, so an
 *   events-only watchlist reported a plainly active realm as dead (#211).
 * - Calls alone are fine for that case, but a package's events are attributed
 *   to whoever emitted them: calling `r/gnoswap/gns` emits Transfer/Approval
 *   under `p/demo/tokens/grc20`, so a library that is busy on a chain's behalf
 *   shows up in events and never in `packagePaths` (#210).
 *
 * `packagePaths` is the realm a transaction actually invoked (MsgCall's
 * pkg_path, or MsgAddPackage's path), not the emitter — so a tx touching three
 * realms counts for all three, which is what "was my realm involved" means.
 * @param {object[]} transactions recent transactions, newest first
 * @param {object[]} events recent chain events, newest first
 * @returns {object} last-touched height and call count per package path
 */
export function scanActivity(
  transactions: { height: number; packagePaths: string[] }[],
  events: { height: number; pkgPath: string | null }[]
): ActivityScan {
  const byPath = new Map<string, PathActivity>();
  let oldestScanned: number | null = null;

  function note(path: string, height: number, isCall: boolean) {
    const existing = byPath.get(path);
    if (!existing) {
      byPath.set(path, { lastHeight: height, callCount: isCall ? 1 : 0 });
      return;
    }
    // max, not last-write: neither source is guaranteed sorted, and a caller
    // that widened its window can return an older batch after a newer one.
    if (height > existing.lastHeight) existing.lastHeight = height;
    if (isCall) existing.callCount += 1;
  }

  for (const tx of transactions) {
    oldestScanned = oldestScanned === null ? tx.height : Math.min(oldestScanned, tx.height);
    // Deduplicated per transaction: a multi-message tx can name the same realm
    // twice, and that is one call, not two.
    for (const path of new Set(tx.packagePaths)) note(path, tx.height, true);
  }

  for (const event of events) {
    oldestScanned =
      oldestScanned === null ? event.height : Math.min(oldestScanned, event.height);
    if (!event.pkgPath) continue;
    note(event.pkgPath, event.height, false);
  }

  return { byPath, oldestScanned };
}
