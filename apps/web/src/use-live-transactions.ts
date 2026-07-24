import { useEffect, useRef, useState } from "react";
import { useSdk } from "./sdk-context";
import type { BlockEvents } from "@gnomputer/app-sdk";

const POLL_INTERVAL_MS = 4000;
const MAX_TXS_SHOWN = 60;
const MAX_BACKFILL_PER_TICK = 5;

export interface LiveTransaction {
  height: number;
  txIndex: number;
  success: boolean;
  gasWanted: number;
  gasUsed: number;
  eventCount: number;
  pkgPaths: string[];
}

/** Pulled out of the polling loop so it can be unit-tested against a fixed
 * BlockEvents fixture instead of depending on the live chain having a
 * transaction in whatever block window a test happens to run in. */
export function blockToTransactions(block: BlockEvents): LiveTransaction[] {
  return block.txs.map((tx) => ({
    height: block.height,
    txIndex: tx.txIndex,
    success: tx.success,
    gasWanted: tx.gasWanted,
    gasUsed: tx.gasUsed,
    eventCount: tx.events.length,
    pkgPaths: [...new Set(tx.events.map((e) => e.pkgPath).filter((p): p is string => p !== null))],
  }));
}

/** Same polling loop as use-live-events.ts, but keeps one row per
 * transaction instead of flattening to one row per event — gnoscan-style
 * "recent transactions" needs the tx-level fields (success, gas) that
 * flattening throws away, not just the events a tx happened to emit. */
export function useLiveTransactions(paused = false): { transactions: LiveTransaction[] } {
  const sdk = useSdk();
  const [transactions, setTransactions] = useState<LiveTransaction[]>([]);
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

        const newTxs: LiveTransaction[] = results.flatMap(blockToTransactions);

        if (heights.length > 0) {
          lastSeenHeight.current = latest;
          if (newTxs.length > 0) {
            setTransactions((prev) => [...newTxs].reverse().concat(prev).slice(0, MAX_TXS_SHOWN));
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

  return { transactions };
}
