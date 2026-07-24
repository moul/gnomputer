import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useWindowStore, type WindowRecord } from "./window-store";

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

export function useWindowPersistence(storageKey: string) {
  const sdk = useSdk();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw = await sdk.uiState.get(storageKey);
      if (cancelled) return;
      if (raw) {
        try {
          const saved = filterValidWindows(JSON.parse(raw));
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
        } catch {
          // Corrupt or outdated stored layout — fall back to defaults rather
          // than crash the desktop.
        }
      }
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, storageKey]);

  useEffect(() => {
    const unsubscribe = useWindowStore.subscribe((state) => {
      if (!hydrated.current) return;
      void sdk.uiState.set(storageKey, JSON.stringify(state.windows));
    });
    return unsubscribe;
  }, [sdk, storageKey]);
}
