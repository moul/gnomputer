import type { WindowRecord } from "./window-store";

export interface FamilyFocusActions {
  focus: (id: string) => void;
  reopen: (id: string) => void;
}

/** Shared by the island's multi-window Browser icon and its grouped icons
 * (e.g. "Chain" standing in for Network/Validator/Block/Event/Gnockpit):
 * one click should land on whichever member window was most recently
 * active, not always the same fixed one and not always a fresh instance.
 * Falls back to opening defaultId when no member window is currently open. */
export function focusFamilyOrOpenDefault(
  memberIds: string[],
  defaultId: string,
  windows: Record<string, WindowRecord>,
  actions: FamilyFocusActions
): string {
  let best: { id: string; zIndex: number } | null = null;
  for (const id of memberIds) {
    const w = windows[id];
    if (!w || w.closed) continue;
    if (!best || w.zIndex > best.zIndex) best = { id, zIndex: w.zIndex };
  }
  if (best) {
    actions.focus(best.id);
    return best.id;
  }
  actions.reopen(defaultId);
  return defaultId;
}

export function realmFamilyIds(windows: Record<string, WindowRecord>): string[] {
  return Object.keys(windows).filter((id) => id === "realm" || id.startsWith("realm-"));
}
