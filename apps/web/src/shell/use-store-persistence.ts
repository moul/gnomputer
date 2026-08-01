import { useEffect, useRef, useState } from "react";
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

/** Companion key holding when the IndexedDB value was written, so hydrate
 * can tell which of the two copies is newer. Kept beside the value rather
 * than wrapped around it so every value already stored stays readable. */
function writtenAtKey(storageKey: string): string {
  return `${storageKey}:writtenAt`;
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

function writeMirror(storageKey: string, value: string, at: number): void {
  try {
    localStorage.setItem(mirrorKey(storageKey), JSON.stringify({ value, at }));
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
 * force a re-fetch from sdk.uiState on every render.
 *
 * Returns whether the initial read has completed. Callers that need to
 * distinguish "not stored" from "not read yet" depend on this — see
 * use-network-persistence, where a custom network id that hasn't hydrated
 * looks exactly like one that no longer exists. */
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
  // Both a ref and state: the ref is read inside the subscribe callback
  // below, which would otherwise close over a stale value, while the state
  // is what lets a caller re-render once hydration finishes.
  const hydrated = useRef(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const serialize = options?.serialize ?? ((state: T) => JSON.stringify(state));
  const deserialize = options?.deserialize ?? defaultDeserialize<T>;
  const onRestore = options?.onRestore;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [stored, storedAt] = await Promise.all([
        sdk.uiState.get(storageKey),
        sdk.uiState.get(writtenAtKey(storageKey)),
      ]);
      const mirror = readMirror(storageKey);

      // Whichever was written last wins, decided by comparing timestamps
      // rather than by a fixed preference.
      //
      // Preferring the mirror unconditionally is wrong: the two disagree
      // routinely (the mirror is written a moment before IndexedDB commits,
      // and another tab can update IndexedDB), so a stale mirror could
      // resurrect data the app had deliberately moved past. A test that
      // stores corrupt JSON and expects defaults caught that happening.
      //
      // But preferring IndexedDB unconditionally — the previous rule — only
      // fixed an aborted FIRST write. When IndexedDB already held an older
      // value and the newer write was aborted by the navigation, the older
      // value won. That was user-visible: change network, reload
      // immediately, land back on the previous one. An e2e caught it under
      // load, exactly as the comment here predicted it would behave.
      //
      // A missing IndexedDB timestamp means the value predates this and
      // keeps its old precedence, so nothing already stored is overridden
      // by a mirror of unknown age.
      // Parsed only from a real string. Number(null) is 0, which is finite
      // — reading a missing timestamp as the epoch would make the mirror
      // win every time, which is precisely the bug this rule replaced.
      const storedTime = typeof storedAt === "string" && storedAt !== "" ? Number(storedAt) : NaN;
      const useMirror =
        mirror !== null &&
        (stored === null ||
          stored === undefined ||
          (Number.isFinite(storedTime) && mirror.at > storedTime));
      const raw = (useMirror ? mirror.value : stored) ?? mirror?.value ?? null;
      if (!cancelled && raw) {
        const restored = deserialize(raw);
        if (restored) {
          if (onRestore) onRestore(restored);
          else store.setState(restored);
        }
      }
      hydrated.current = true;
      if (!cancelled) setIsHydrated(true);
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
      const at = Date.now();
      writeMirror(storageKey, value, at);
      void sdk.uiState.set(storageKey, value);
      void sdk.uiState.set(writtenAtKey(storageKey), String(at));
    });
    // serialize/deserialize/onRestore deliberately omitted — see doc comment above.
  }, [sdk, storageKey, store]);

  return isHydrated;
}
