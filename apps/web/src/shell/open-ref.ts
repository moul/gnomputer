import { router } from "../routes/root";
import { useWindowStore } from "./window-store";
import { usePendingRefsStore } from "./pending-refs-store";
import { openSettings } from "./open-settings";

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
  const match = /^gno:\/\/[^/]+\/(realm|source-file|address|block)\/(.*)$/.exec(uri);
  if (!match) return false;
  const [, kind, rest] = match;
  if (kind === undefined || rest === undefined) return false;

  switch (kind) {
    case "realm": {
      const [packagePath, renderPath] = rest.split("#");
      void router.navigate({ to: "/", search: renderPath ? { pkg: packagePath, path: renderPath } : { pkg: packagePath } });
      focusOrReopen("realm");
      return true;
    }
    case "source-file": {
      void router.navigate({ to: "/", search: { pkg: rest } });
      focusOrReopen("source");
      return true;
    }
    case "address": {
      usePendingRefsStore.getState().setPendingAddress(rest);
      openSettings("user");
      return true;
    }
    case "block": {
      const height = Number(rest);
      if (!Number.isFinite(height)) return false;
      usePendingRefsStore.getState().setPendingBlockHeight(height);
      focusOrReopen("block-explorer");
      return true;
    }
    default:
      return false;
  }
}
