import { useEffect, useRef, useState } from "react";
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
export function useLiveEvents(paused = false, pkgPath?: string): { events: LiveEvent[] } {
  const sdk = useSdk();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const lastSeenHeight = useRef<number | null>(null);

  const { height } = useChainHeight(!paused);
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

        const results = await Promise.all(
          heights.map((h) => sdk.rpc.getBlockEvents(h, new Date().toISOString()).then((env) => env.data))
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
  }, [sdk, paused, pkgPath, height]);

  return { events };
}
