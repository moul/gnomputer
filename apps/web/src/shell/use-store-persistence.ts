import { useEffect, useRef } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import { useSdk } from "../sdk-context";

// IndexedDB writes are asynchronous, and navigating away ABORTS an
// in-flight transaction. So changing a theme (or layout, zoom, settings)
// and reloading a moment later silently lost the change — reproduced
// reliably in the e2e suite, where inserting a 1s pause before the reload
// was the difference between pass and fail.
//
// Every value here is a small UI preference, so each write is mirrored
// synchronously into localStorage, which cannot be interrupted by a
// navigation. IndexedDB stays the store of record (it holds everything
// else and survives more); localStorage is consulted on hydrate only when
// IndexedDB has nothing, or when the mirror is newer than what IndexedDB
// returned — i.e. exactly the aborted-write case.
const MIRROR_PREFIX = "gnomputer:mirror:";

function mirrorKey(storageKey: string): string {
  return `${MIRROR_PREFIX}${storageKey}`;
}

interface Mirrored {
  value: string;
  at: number;
}

function readMirror(storageKey: string): Mirrored | null {
  try {
    const raw = localStorage.getItem(mirrorKey(storageKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Mirrored;
    return typeof parsed?.value === "string" ? parsed : null;
  } catch {
    // A corrupt or unavailable mirror must never block hydration.
    return null;
  }
}

function writeMirror(storageKey: string, value: string): void {
  try {
    localStorage.setItem(mirrorKey(storageKey), JSON.stringify({ value, at: Date.now() }));
  } catch {
    // Private mode / quota — the IndexedDB write is still the real one.
  }
}

function defaultDeserialize<T>(raw: string): Partial<T> | null {
  try {
    return JSON.parse(raw) as Partial<T>;
  } catch {
    return null;
  }
}

/** Generic load-then-subscribe persistence for a zustand store, backed by
 * sdk.uiState. Covers three shapes of store, via the optional hooks:
 *   - plain JSON blob of the whole state (the default: serialize/deserialize
 *     both fall back to JSON.stringify/parse) — see address-window.tsx,
 *     resources.tsx.
 *   - a single scalar field, or a sub-object, rather than the whole state —
 *     pass a custom serialize/deserialize pair (e.g. use-theme-persistence
 *     stores just the theme id string, not a JSON-wrapped object).
 *   - a restore that must run through the store's own setter rather than a
 *     raw setState merge, because that setter has a side effect beyond
 *     updating state (use-theme-persistence's setTheme also writes the
 *     data-theme DOM attribute; use-zoom-persistence's setZoom also writes
 *     the .desktop CSS zoom property) — pass onRestore.
 * deserialize returning null/undefined means "don't restore, keep defaults"
 * — the validation half of this: a stored value that no longer matches the
 * current shape (a renamed field, a removed enum member, ...) falls back to
 * defaults instead of silently producing undefined fields downstream.
 * serialize/deserialize/onRestore are expected to be stable (module-level)
 * functions, not fresh closures each render — they're deliberately left out
 * of the effect dependency arrays below so passing a fresh arrow doesn't
 * force a re-fetch from sdk.uiState on every render. */
export function useStorePersistence<T extends object>(
  storageKey: string,
  store: UseBoundStore<StoreApi<T>>,
  options?: {
    serialize?: (state: T) => string;
    deserialize?: (raw: string) => Partial<T> | null | undefined;
    onRestore?: (restored: Partial<T>) => void;
  }
) {
  const sdk = useSdk();
  const hydrated = useRef(false);
  const serialize = options?.serialize ?? ((state: T) => JSON.stringify(state));
  const deserialize = options?.deserialize ?? defaultDeserialize<T>;
  const onRestore = options?.onRestore;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await sdk.uiState.get(storageKey);
      // Prefer the synchronous mirror when IndexedDB has nothing (its write
      // was aborted by a navigation) or when the two disagree — the mirror
      // is written last, so it reflects the most recent change.
      const mirrored = readMirror(storageKey);
      const raw = stored && (!mirrored || mirrored.value === stored) ? stored : (mirrored?.value ?? stored);
      if (!cancelled && raw) {
        const restored = deserialize(raw);
        if (restored) {
          if (onRestore) onRestore(restored);
          else store.setState(restored);
        }
      }
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // serialize/deserialize/onRestore deliberately omitted — see doc comment above.
  }, [sdk, storageKey, store]);

  useEffect(() => {
    return store.subscribe((state) => {
      if (!hydrated.current) return;
      const value = serialize(state);
      // Synchronous first, so a reload immediately after this cannot lose it.
      writeMirror(storageKey, value);
      void sdk.uiState.set(storageKey, value);
    });
    // serialize/deserialize/onRestore deliberately omitted — see doc comment above.
  }, [sdk, storageKey, store]);
}
