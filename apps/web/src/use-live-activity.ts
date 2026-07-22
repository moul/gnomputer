import { useEffect, useRef, useState } from "react";
import { useSdk } from "./sdk-context";
import type { BlockSummary } from "@gnomputer/app-sdk";

const POLL_INTERVAL_MS = 4000;
const MAX_BLOCKS_SHOWN = 12;
const MAX_BACKFILL_PER_TICK = 5;

export function useLiveActivity(): { blocks: BlockSummary[] } {
  const sdk = useSdk();
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const lastSeenHeight = useRef<number | null>(null);

  useEffect(() => {
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

        const fetched = await Promise.all(
          heights.map((h) => sdk.rpc.getBlockSummary(h).then((env) => env.data))
        );
        if (cancelled) return;

        if (fetched.length > 0) {
          lastSeenHeight.current = latest;
          setBlocks((prev) => [...fetched].reverse().concat(prev).slice(0, MAX_BLOCKS_SHOWN));
        }
      } catch {
        // A transient RPC hiccup shouldn't take the whole activity feed down —
        // the next tick just tries again.
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sdk]);

  return { blocks };
}
