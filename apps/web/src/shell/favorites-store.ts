import { useEffect } from "react";
import { create } from "zustand";
import type { FavoriteRecord, GnomputerSDK } from "@gnomputer/app-sdk";
import { useSdk } from "../sdk-context";

/** Favorites: realms you marked to come back to (AUD-044).
 *
 * The storage half of this shipped in v1 — a `favorites` table, an SDK with
 * `list`/`toggle`, and a place in the export/import set — and then nothing
 * ever called it. The architecture implied a feature that did not exist,
 * which is worse than not having one: the crash-recovery screen promised to
 * preserve favorites that could not exist (fixed in #163).
 *
 * A refUri is network-scoped (`gno://<network>/realm/<path>`), because a
 * path on Topaz and the same path on betanet are different deployments and
 * may not both exist. The Browser home therefore shows the active network's
 * favorites only, rather than offering to open something that isn't there.
 *
 * Hydrated once per session and then kept in memory: every consumer needs
 * the whole list to answer "is this one starred", and re-reading IndexedDB
 * per realm toolbar would be a query per open tab. */
interface FavoritesState {
  favorites: FavoriteRecord[];
  /** The difference between "you have no favorites" and "we haven't looked
   * yet" — the star renders unset in both, but only one should persist a
   * toggle against an unread list. */
  hydrated: boolean;
  setAll: (favorites: FavoriteRecord[]) => void;
  apply: (record: FavoriteRecord, add: boolean) => void;
}

export const useFavoritesStore = create<FavoritesState>((set) => ({
  favorites: [],
  hydrated: false,
  setAll: (favorites) => set({ favorites, hydrated: true }),
  apply: (record, add) =>
    set((s) => ({
      favorites: add
        ? [...s.favorites.filter((f) => f.refUri !== record.refUri), record]
        : s.favorites.filter((f) => f.refUri !== record.refUri),
    })),
}));

export function favoriteUri(networkId: string, packagePath: string): string {
  return `gno://${networkId}/realm/${packagePath}`;
}

/** The realm path back out of a refUri this module wrote, or null if the
 * URI is not a realm reference. Favorites are realms today; a trail step or
 * an address that found its way into the table is skipped rather than
 * rendered as a broken row. */
export function favoritePackagePath(refUri: string, networkId: string): string | null {
  const prefix = `gno://${networkId}/realm/`;
  if (!refUri.startsWith(prefix)) return null;
  const path = refUri.slice(prefix.length);
  return path === "" ? null : path;
}

/** Optimistic, then reverted if the write fails.
 *
 * Unlike preferences, a star is a deliberate act with a visible result, so
 * the usual fire-and-forget treatment is wrong here: silently not saving
 * would leave the UI claiming something the database does not agree with as
 * soon as you reload. */
export async function toggleFavorite(
  sdk: GnomputerSDK,
  networkId: string,
  packagePath: string,
  label: string
): Promise<void> {
  const refUri = favoriteUri(networkId, packagePath);
  const { favorites, apply } = useFavoritesStore.getState();
  const wasFavorite = favorites.some((f) => f.refUri === refUri);
  const record: FavoriteRecord = { refUri, label, createdAt: new Date().toISOString() };

  apply(record, !wasFavorite);
  try {
    await sdk.favorites.toggle(refUri, label);
  } catch (error) {
    apply(record, wasFavorite);
    console.warn("Could not save that favorite — local storage is unavailable.", error);
  }
}

export function useFavorites(): {
  favorites: FavoriteRecord[];
  hydrated: boolean;
  networkId: string;
} {
  const sdk = useSdk();
  const favorites = useFavoritesStore((s) => s.favorites);
  const hydrated = useFavoritesStore((s) => s.hydrated);
  const networkId = sdk.networks.getActive().id;

  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;
    // try/catch around the await, not .then(ok, err): where IndexedDB is
    // blocked outright — Firefox private browsing, a locked-down enterprise
    // profile — reading `window.indexedDB` THROWS rather than returning
    // something that rejects. `sdk.favorites.list()` then throws
    // synchronously, before there is a promise to attach a handler to, and
    // the throw escapes the effect into the error boundary. That is a crash
    // screen on a browser the app otherwise runs on perfectly well; an e2e
    // caught it.
    //
    // Storage being unavailable means "no favorites", not "keep asking".
    void (async () => {
      try {
        const rows = await sdk.favorites.list();
        if (!cancelled) useFavoritesStore.getState().setAll(rows);
      } catch {
        if (!cancelled) useFavoritesStore.getState().setAll([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, hydrated]);

  return { favorites, hydrated, networkId };
}

/** Active-network favorites, newest first, as realm paths. */
export function useFavoriteRealms(): { packagePath: string; label: string }[] {
  const { favorites, networkId } = useFavorites();
  return favorites
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((f) => {
      const packagePath = favoritePackagePath(f.refUri, networkId);
      return packagePath ? { packagePath, label: f.label } : null;
    })
    .filter((f): f is { packagePath: string; label: string } => f !== null);
}
