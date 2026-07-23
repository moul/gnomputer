import { router } from "../routes/root";
import { useWindowStore } from "./window-store";
import { usePendingRefsStore } from "./pending-refs-store";
import { openSettings } from "./open-settings";
import { openInRealmTab } from "./open-in-realm-tab";
import { isSettingsTab } from "./settings-store";
import { useAddressWindowStore } from "./address-window-store";
import type { EntityKind } from "./entity-patterns";

function focusOrReopen(id: string) {
  const win = useWindowStore.getState().windows[id];
  if (!win) return;
  if (win.closed || win.minimized) useWindowStore.getState().reopen(id);
  else useWindowStore.getState().focus(id);
}

// Parses the subset of gno:// URIs the trail currently records (spec §8.1's
// full URI grammar is broader — this covers what a click-through needs today
// and grows alongside the universal EntityLink work).
export function openRef(uri: string): boolean {
  const match = /^gno:\/\/[^/]+\/(realm|source-file|address|block|settings)\/(.*)$/.exec(uri);
  if (!match) return false;
  const [, kind, rest] = match;
  if (kind === undefined || rest === undefined) return false;

  switch (kind) {
    case "realm": {
      const [packagePath, renderPath] = rest.split("#");
      openInRealmTab("realm", { packagePath: packagePath ?? "", renderPath, lens: "render" });
      focusOrReopen("realm");
      return true;
    }
    case "source-file": {
      openInRealmTab("realm", { packagePath: rest, lens: "source" });
      focusOrReopen("realm");
      return true;
    }
    case "address": {
      useAddressWindowStore.getState().setCurrentAddress(rest);
      focusOrReopen("address");
      return true;
    }
    case "block": {
      const height = Number(rest);
      if (!Number.isFinite(height)) return false;
      usePendingRefsStore.getState().setPendingBlockHeight(height);
      focusOrReopen("block-explorer");
      return true;
    }
    case "settings": {
      if (!isSettingsTab(rest)) return false;
      openSettings(rest);
      return true;
    }
    default:
      return false;
  }
}

/** Opens a single entity match — text matched wholesale by matchWholeEntity
 * (search bar) or one span found inline by matchEntityAt (Linkify). */
export function openEntityMatch(kind: EntityKind, text: string): void {
  switch (kind) {
    case "address":
      openRef(`gno://_/address/${text}`);
      return;
    case "block":
      openRef(`gno://_/block/${text.replace(/^#/, "")}`);
      return;
    case "realm": {
      const packagePath = text.startsWith("r/") ? `gno.land/${text}` : text;
      openRef(`gno://_/realm/${packagePath}`);
      return;
    }
    case "username":
      // r/sys/users doesn't expose a confirmed per-user render path, so the
      // best honest click-through today is the users realm itself rather
      // than guessing a URL that might 404.
      void router.navigate({ to: "/", search: { pkg: "gno.land/r/sys/users" } });
      return;
  }
}
