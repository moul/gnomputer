import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSdk } from "./sdk-context";
import { useChainHeight } from "./use-chain-height";
import type { ChainEvent } from "@gnomputer/app-sdk";

const MAX_EVENTS_SHOWN = 40;
const MAX_BACKFILL_PER_TICK = 5;

export interface LiveEvent extends ChainEvent {
  height: number;
  txIndex: number;
}

/** Polls recent blocks and, for any with transactions, fetches their real
 * ABCI events via getBlockEvents — no indexer, no CORS wall, just the same
 * RPC host every other query already uses (see ADR-015's update).
 *
 * An optional pkgPath filters to events from one package (e.g. the Realm
 * Browser's History lens) — applied before the MAX_EVENTS_SHOWN cap, so an
 * unrelated realm's events can't push a filtered-for realm's own events out
 * of the window. */
export function useLiveEvents(
  paused = false,
  pkgPath?: string
): { events: LiveEvent[]; isError: boolean } {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const lastSeenHeight = useRef<number | null>(null);

  const { height, isError } = useChainHeight(!paused);
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

        // Through react-query's cache, on the same key the Block Explorer's
        // detail pane uses, rather than calling the RPC directly.
        //
        // Every instance of this hook used to fetch every block's events for
        // itself: Event Explorer and the Browser home's "Recently active"
        // both call it, so with both open each block was fetched twice, and
        // each realm window that wanted to watch its own package would have
        // added another copy. Sharing one request per height is what makes a
        // per-realm watcher free (use-realm-change-watch.ts) instead of a
        // multiplier on RPC load.
        //
        // staleTime Infinity because a finalized block's events are
        // immutable — the reason this is cacheable at all, and why revisiting
        // a block in the explorer now costs nothing.
        const results = await Promise.all(
          heights.map((h) =>
            queryClient.fetchQuery({
              queryKey: ["block-events", networkId, h],
              queryFn: async () =>
                (await sdk.rpc.getBlockEvents(h, new Date().toISOString())).data,
              staleTime: Infinity,
            })
          )
        );
        if (cancelled) return;

        const newEvents: LiveEvent[] = [];
        for (const block of results) {
          for (const tx of block.txs) {
            for (const event of tx.events) {
              if (pkgPath !== undefined && event.pkgPath !== pkgPath) continue;
              newEvents.push({ ...event, height: block.height, txIndex: tx.txIndex });
            }
          }
        }

        lastSeenHeight.current = height;
        if (newEvents.length > 0) {
          setEvents((prev) => [...newEvents].reverse().concat(prev).slice(0, MAX_EVENTS_SHOWN));
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
  }, [sdk, networkId, queryClient, paused, pkgPath, height]);

  return { events, isError };
}
