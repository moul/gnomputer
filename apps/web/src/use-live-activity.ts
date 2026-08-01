import { useEffect, useRef, useState } from "react";
import { useSdk } from "./sdk-context";
import { useChainHeight } from "./use-chain-height";
import type { BlockSummary } from "@gnomputer/app-sdk";

const MAX_BLOCKS_SHOWN = 12;
const MAX_BACKFILL_PER_TICK = 5;

/** Recent blocks, appended as the chain advances.
 *
 * The tip height comes from the shared `useChainHeight()` subscription
 * rather than this hook running its own `getStatus()` loop — see ADR-017.
 * That means several live views open at once share one status poll, and a
 * hidden tab stops polling altogether. This hook only fetches the block
 * summaries it doesn't already have. */
export function useLiveActivity(paused = false): { blocks: BlockSummary[] } {
  const sdk = useSdk();
  const { height } = useChainHeight(!paused);
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const lastSeenHeight = useRef<number | null>(null);
  // Guards against a slow fetch overlapping the next height tick, which
  // would double-fetch the same blocks.
  const inFlight = useRef(false);

  useEffect(() => {
    if (paused || height === null || inFlight.current) return;
    if (lastSeenHeight.current === null) lastSeenHeight.current = height - 1;
    if (height <= lastSeenHeight.current) return;

    let cancelled = false;
    inFlight.current = true;

    void (async () => {
      try {
        const from = Math.max(lastSeenHeight.current! + 1, height - MAX_BACKFILL_PER_TICK + 1);
        const heights: number[] = [];
        for (let h = from; h <= height; h++) heights.push(h);

        const fetched = await Promise.all(
          heights.map((h) => sdk.rpc.getBlockSummary(h).then((env) => env.data))
        );
        if (cancelled) return;

        lastSeenHeight.current = height;
        if (fetched.length > 0) {
          setBlocks((prev) => [...fetched].reverse().concat(prev).slice(0, MAX_BLOCKS_SHOWN));
        }
      } catch {
        // A transient RPC hiccup shouldn't take the feed down — the next
        // height tick retries from the same lastSeenHeight.
      } finally {
        inFlight.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sdk, paused, height]);

  return { blocks };
}
