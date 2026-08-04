import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSdk } from "./sdk-context";
import { useLiveEvents } from "./use-live-events";

export interface RealmChange {
  /** The block the change was finalized in. Not "just now" — a block height
   * is the only honest timestamp for a chain mutation. */
  height: number;
  /** The event type the realm emitted, e.g. "Increment" or "Transfer".
   * Several in one block collapse to the most recent. */
  eventType: string;
  /** How many events arrived in this batch, so the badge can say "3 changes"
   * rather than silently reporting only the last. */
  count: number;
}

/** Notices when the realm you are looking at changes on chain, and refetches
 * it.
 *
 * The Render lens fetched once and never again, so a realm could change under
 * you and the view would keep showing the old output until you pressed
 * refresh. That is the opposite of what this app claims to be: #90's whole
 * thesis is that a shared computer should prove itself by making propagation
 * legible.
 *
 * Driven by the events the realm itself emits, not by polling the render
 * output. Polling every open realm every block would be one abci_query per
 * realm per block for a result that is usually identical; an event naming
 * this package is positive evidence that something actually happened, and the
 * event feed is already being polled for other reasons.
 *
 * A realm that mutates state without emitting an event will not be caught.
 * That is a real limitation and the right one to accept: the alternative
 * costs every user continuous queries to detect something that mostly has
 * not happened.
 */
export function useRealmChangeWatch(
  packagePath: string,
  enabled: boolean
): { change: RealmChange | null; acknowledge: () => void } {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const queryClient = useQueryClient();
  const active = enabled && packagePath !== "";
  const { events } = useLiveEvents(!active, active ? packagePath : undefined);
  const [change, setChange] = useState<RealmChange | null>(null);

  // The height already accounted for. Starts unset and is primed to whatever
  // the feed has already collected on the first pass, so opening a realm does
  // not immediately announce a change for an event that happened before you
  // arrived — which would be a badge on every single open.
  const highWaterMark = useRef<number | null>(null);

  // Reset when the watched realm or network changes: a high-water mark from a
  // different package means nothing here, and carrying it over would either
  // suppress a real change or invent one.
  useEffect(() => {
    highWaterMark.current = null;
    setChange(null);
  }, [packagePath, networkId]);

  useEffect(() => {
    if (!active) return;
    const newest = events[0];
    if (!newest) return;

    if (highWaterMark.current === null) {
      highWaterMark.current = newest.height;
      return;
    }
    if (newest.height <= highWaterMark.current) return;

    const fresh = events.filter((e) => e.height > highWaterMark.current!);
    highWaterMark.current = newest.height;
    setChange({ height: newest.height, eventType: newest.type, count: fresh.length });

    // The point of noticing is showing the new state, not just announcing it.
    // Invalidating rather than refetching so a realm in a background window
    // reloads when it is next looked at instead of immediately.
    void queryClient.invalidateQueries({ queryKey: ["realm-render", networkId, packagePath] });
    void queryClient.invalidateQueries({ queryKey: ["realm-state", networkId, packagePath] });
  }, [events, active, networkId, packagePath, queryClient]);

  return { change, acknowledge: () => setChange(null) };
}
