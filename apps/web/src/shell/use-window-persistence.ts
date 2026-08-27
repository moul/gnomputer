import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { useWindowStore, type WindowRecord } from "./window-store";
import { isPhoneViewport } from "./viewport";

export function isWindowRecord(value: unknown): value is WindowRecord {
  if (typeof value !== "object" || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    typeof w.x === "number" &&
    typeof w.y === "number" &&
    typeof w.width === "number" &&
    typeof w.height === "number" &&
    typeof w.title === "string" &&
    typeof w.zIndex === "number" &&
    typeof w.closed === "boolean" &&
    typeof w.maximized === "boolean"
  );
}

/** Keeps only entries that actually still look like a WindowRecord — an
 * old/renamed field shape from a previous schema shouldn't crash the
 * desktop or restore a window into a broken half-initialized state, and
 * dropping just the malformed entries (rather than the whole layout) means
 * one stale id doesn't cost every other window its saved position too. */
export function filterValidWindows(parsed: unknown): Record<string, WindowRecord> {
  if (typeof parsed !== "object" || parsed === null) return {};
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isWindowRecord(v)));
}

interface Viewport {
  width: number;
  height: number;
}

/** Reads a stored layout in either shape.
 *
 * Layouts used to be a bare map of windows. They now carry the viewport
 * they were saved at, so a restore can tell "this came from a bigger
 * screen" from "you are back where you saved it". A layout with no viewport
 * predates that and is treated as unknown — which means fitting into view,
 * the safe direction: a window pulled on-screen is recoverable, one left
 * off it is not. */
export function parseLayout(raw: string): {
  windows: Record<string, WindowRecord>;
  viewport: Viewport | null;
} {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed === "object" && parsed !== null && "windows" in parsed) {
    const shaped = parsed as { windows: unknown; viewport?: unknown };
    const viewport = shaped.viewport as Viewport | undefined;
    return {
      windows: filterValidWindows(shaped.windows),
      viewport:
        viewport && typeof viewport.width === "number" && typeof viewport.height === "number"
          ? viewport
          : null,
    };
  }
  return { windows: filterValidWindows(parsed), viewport: null };
}

/**
 * Restores and saves the desktop layout for the active network.
 *
 * The layout is per-network for the same reason the realm tabs are: which
 * windows you had open, and what they were showing, belongs to a chain. A
 * Block window sitting on a height, an Address window on an account — neither
 * survives being pointed at a different chain, so carrying the desktop across
 * left windows that looked untouched and meant nothing.
 * @param {string} baseKey the layout key, before the network is appended
 */
export function useWindowPersistence(baseKey: string) {
  const sdk = useSdk();
  const networkId = useShellStore((s) => s.activeNetworkId);
  const switchSeq = useShellStore((s) => s.networkSwitchSeq);
  const seenSwitchSeq = useRef(switchSeq);
  /** `activeNetworkId` is a placeholder until this flips — see the store. The
   * layout must not be read from, or written to, the default network's key
   * just because that is what the store says before the real one is known. */
  const networkHydrated = useShellStore((s) => s.networkHydrated);
  const storageKey = `${baseKey}:${networkId}`;
  /** Which key writes belong to, so a change landing mid-switch cannot save
   * the outgoing chain's desktop under the incoming chain's key. */
  const activeKey = useRef(storageKey);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!networkHydrated) return;
    let cancelled = false;
    const isSwitch = switchSeq !== seenSwitchSeq.current;
    seenSwitchSeq.current = switchSeq;
    activeKey.current = storageKey;
    hydrated.current = false;

    void (async () => {
      // Clear first, so the desktop that comes back is this network's and not
      // the previous one's with a few windows overwritten. Everything mounted
      // re-registers itself through ensureWindow with its defaults.
      if (isSwitch) useWindowStore.setState({ windows: {}, topZIndex: 1 });

      const raw = await sdk.uiState.get(storageKey);
      if (cancelled) return;
      if (raw) {
        try {
          const { windows: saved, viewport: savedViewport } = parseLayout(raw);
          // Windows mounted before this async load resolved already ran
          // ensureWindow() with their hardcoded defaults — the saved layout
          // must win for any id it covers, so it goes second in the spread.
          useWindowStore.setState((state) => {
            const windows = { ...state.windows, ...saved };
            // topZIndex itself isn't persisted, so it resets low on every
            // reload — if a restored window's zIndex is higher than that
            // reset value, focus() would compute a "next" zIndex that's
            // still lower than some other (untouched) window's restored
            // one, permanently stranding focus on whatever had the highest
            // zIndex last session no matter what gets clicked afterward.
            const maxRestoredZ = Object.values(windows).reduce(
              (max, w) => Math.max(max, w.zIndex),
              0
            );
            return { windows, topZIndex: Math.max(state.topZIndex, maxRestoredZ) };
          });

          // A layout is saved with the geometry of the screen it was made
          // on. Restoring it somewhere smaller — a desktop layout opened on
          // a phone, or just a narrower window — left windows positioned
          // past the right edge at sizes wider than the viewport, i.e.
          // unreachable (AUD-008). Only when the screen actually got
          // smaller — see parseLayout.
          //
          // fitAllIntoView, not reclampAll: reclampAll applies the DRAG
          // rule, which deliberately lets a window hang off the edge as
          // long as a sliver and its titlebar stay reachable — correct when
          // a user parked it there, wrong for a layout that simply arrived
          // from a bigger screen. Restoring at 800px with reclampAll left
          // an 800px-wide window at left: 640px: grabbable, useless.
          const shrunk =
            savedViewport === null ||
            window.innerWidth < savedViewport.width ||
            window.innerHeight < savedViewport.height;
          if (shrunk) useWindowStore.getState().fitAllIntoView();

          // On a phone, clamping is not enough: a tiled desktop layout
          // squeezed into 390px is technically on-screen and still
          // unusable. A freshly-opened window already starts maximized
          // there, so a restored one matches rather than being the one
          // thing on the device that isn't.
          if (isPhoneViewport()) {
            useWindowStore.setState((state) => ({
              windows: Object.fromEntries(
                Object.entries(state.windows).map(([id, win]) => [
                  id,
                  win.closed ? win : { ...win, maximized: true },
                ])
              ),
            }));
          }
        } catch {
          // Corrupt or outdated stored layout — fall back to defaults rather
          // than crash the desktop.
        }
      }
      hydrated.current = true;

      if (isSwitch) {
        // Deferred a frame: the windows are mounting as this resolves, and
        // reopen() only acts on a record that already exists. By the next
        // frame every window has registered through ensureWindow.
        const carry = useShellStore.getState().carryWindowId;
        if (carry) {
          requestAnimationFrame(() => {
            useWindowStore.getState().reopen(carry);
            useShellStore.getState().setCarryWindowId(null);
          });
        }
        // The desktop for this chain is up. Whatever the overlay was covering
        // is done, so it can come down — this is the last of the switch to
        // finish.
        useShellStore.getState().setNetworkSwitching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, storageKey, switchSeq, networkHydrated]);

  useEffect(() => {
    const unsubscribe = useWindowStore.subscribe((state) => {
      if (!hydrated.current || activeKey.current !== storageKey) return;
      // The viewport is stored with the layout so a restore can tell
      // "this arrived from a bigger screen" from "you are back where you
      // saved it". Without that, pulling stray windows into view would
      // also undo a window a user deliberately parked half off the edge,
      // on every single reload.
      void sdk.uiState.set(
        storageKey,
        JSON.stringify({
          windows: state.windows,
          viewport: { width: window.innerWidth, height: window.innerHeight },
        })
      );
    });
    return unsubscribe;
  }, [sdk, storageKey]);
}
