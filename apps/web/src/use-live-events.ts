import { useEffect, useRef, useState } from "react";
import { useSdk } from "./sdk-context";
import type { ChainEvent } from "@gnomputer/app-sdk";

const POLL_INTERVAL_MS = 4000;
const MAX_EVENTS_SHOWN = 40;
const MAX_BACKFILL_PER_TICK = 5;

export interface LiveEvent extends ChainEvent {
  height: number;
  txIndex: number;
}

/** Polls recent blocks and, for any with transactions, fetches their real
 * ABCI events via getBlockEvents — no indexer, no CORS wall, just the same
 * RPC host every other query already uses (see ADR-015's update). */
export function useLiveEvents(paused = false): { events: LiveEvent[] } {
  const sdk = useSdk();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const lastSeenHeight = useRef<number | null>(null);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const statusEnv = await sdk.rpc.getStatus();
        if (cancelled) return;
        const latest = statusEnv.data.latestHeight;

        if (lastSeenHeight.current === null) {
          lastSeenHeight.current = latest - 1;
        }

        const from = Math.max(lastSeenHeight.current + 1, latest - MAX_BACKFILL_PER_TICK + 1);
        const heights: number[] = [];
        for (let h = from; h <= latest; h++) heights.push(h);

        const results = await Promise.all(
          heights.map((h) => sdk.rpc.getBlockEvents(h, new Date().toISOString()).then((env) => env.data))
        );
        if (cancelled) return;

        const newEvents: LiveEvent[] = [];
        for (const block of results) {
          for (const tx of block.txs) {
            for (const event of tx.events) {
              newEvents.push({ ...event, height: block.height, txIndex: tx.txIndex });
            }
          }
        }

        if (heights.length > 0) {
          lastSeenHeight.current = latest;
          if (newEvents.length > 0) {
            setEvents((prev) => [...newEvents].reverse().concat(prev).slice(0, MAX_EVENTS_SHOWN));
          }
        }
      } catch {
        // A transient RPC hiccup shouldn't take the whole feed down — the
        // next tick just tries again.
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sdk, paused]);

  return { events };
}
