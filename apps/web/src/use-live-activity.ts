import { useEffect, useRef, useState } from "react";
import { useSdk } from "./sdk-context";
import { useChainHeight } from "./use-chain-height";
import type { BlockSummary } from "@gnomputer/app-sdk";

export const MAX_BLOCKS_SHOWN = 12;
const MAX_BACKFILL_PER_TICK = 5;
/** How many blocks to fetch on the very first tick, so the list is full
 * immediately instead of filling in one row every five seconds.
 *
 * Before this, opening the Block Explorer showed "Watching the chain for
 * new blocks…" and then grew a row at a time — a minute to fill a
 * twelve-row window that is entirely about recent history. The ring buffer
 * was already here; nothing ever primed it. */
const INITIAL_BACKFILL = MAX_BLOCKS_SHOWN;

/** Which heights this tick should fetch, newest last.
 *
 * `seen` is null before anything has been fetched, and that case is the
 * whole point: the first tick reaches back a full window so the list is
 * populated on open, while later ticks only pick up what has appeared since
 * — capped, so returning to a tab that was hidden for an hour does not fire
 * hundreds of requests.
 *
 * Exported to be tested directly. Inside the hook it was reachable only
 * through a chain-height subscription and an SDK, which is a lot of
 * machinery standing between a test and an arithmetic decision. */
export function heightsToFetch(seen: number | null, tip: number): number[] {
  if (seen !== null && tip <= seen) return [];
  const from =
    seen === null
      ? Math.max(tip - INITIAL_BACKFILL + 1, 1)
      : Math.max(seen + 1, tip - MAX_BACKFILL_PER_TICK + 1, 1);
  const heights: number[] = [];
  for (let h = from; h <= tip; h++) heights.push(h);
  return heights;
}

/** Recent blocks, appended as the chain advances.
 *
 * The tip height comes from the shared `useChainHeight()` subscription
 * rather than this hook running its own `getStatus()` loop — see ADR-017.
 * That means several live views open at once share one status poll, and a
 * hidden tab stops polling altogether. This hook only fetches the block
 * summaries it doesn't already have. */
export function useLiveActivity(paused = false): { blocks: BlockSummary[]; isError: boolean } {
  const sdk = useSdk();
  const { height, isError } = useChainHeight(!paused);
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const lastSeenHeight = useRef<number | null>(null);
  // Guards against a slow fetch overlapping the next height tick, which
  // would double-fetch the same blocks.
  const inFlight = useRef(false);
  // Whether the component is still mounted — deliberately NOT the same thing
  // as "this effect invocation was superseded".
  //
  // The two used to be conflated through a per-invocation `cancelled` flag,
  // and StrictMode's double-invoke exposed the cost: the first invocation
  // started the twelve-block backfill, the cleanup marked it cancelled, the
  // second invocation found inFlight set and returned, and the completed
  // fetch then threw its twelve blocks away. The list arrived empty and
  // filled five at a time from the next tick — exactly the behaviour the
  // backfill was added to remove.
  //
  // Blocks that have already been fetched are worth keeping whichever effect
  // invocation asked for them. Only an unmounted component should discard
  // them.
  const mounted = useRef(true);
  useEffect(() => {
    // Set on the way in as well as cleared on the way out. StrictMode runs
    // mount → cleanup → mount, so a cleanup-only version latched this to
    // false on the first simulated unmount and never recovered: every fetch
    // afterwards completed and then discarded its own result, and the feed
    // stayed permanently empty.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (paused || height === null || inFlight.current) return;
    // First tick reaches back INITIAL_BACKFILL blocks; every tick after that
    // only fetches what has appeared since, capped so returning to a tab
    // that has been hidden for an hour does not fire hundreds of requests.
    const heights = heightsToFetch(lastSeenHeight.current, height);
    if (heights.length === 0) return;

    inFlight.current = true;

    void (async () => {
      try {

        // allSettled, not all: the block at the very tip can 404 until it is
        // fully indexed (the Block Explorer carries a two-block safety
        // margin for the same reason). With Promise.all, one such 404 threw
        // away eleven good blocks and left the list empty for another tick —
        // barely noticeable when the batch was five, the difference between
        // a full list and an empty one when it is twelve.
        const settled = await Promise.allSettled(
          heights.map((h) => sdk.rpc.getBlockSummary(h).then((env) => env.data))
        );
        if (!mounted.current) return;
        const fetched = settled
          .filter((r): r is PromiseFulfilledResult<BlockSummary> => r.status === "fulfilled")
          .map((r) => r.value);

        // Advanced even when some heights failed: a gap in a twelve-row
        // "recent blocks" list is not worth re-requesting a block the node
        // has already refused, and the next tick brings newer ones anyway.
        lastSeenHeight.current = height;
        if (fetched.length > 0) {
          // De-duplicated by height: StrictMode, a re-mount, or an overlapping
          // tick can fetch a block that is already on the list, and the ring
          // buffer would otherwise show it twice and push an older one out.
          setBlocks((prev) => {
            const merged = [...fetched].reverse().concat(prev);
            const seenHeights = new Set<number>();
            return merged
              .filter((b) => !seenHeights.has(b.height) && seenHeights.add(b.height))
              .slice(0, MAX_BLOCKS_SHOWN);
          });
        }
      } catch {
        // A transient RPC hiccup shouldn't take the feed down — the next
        // height tick retries from the same lastSeenHeight.
      } finally {
        inFlight.current = false;
      }
    })();
  }, [sdk, paused, height]);

  return { blocks, isError };
}
