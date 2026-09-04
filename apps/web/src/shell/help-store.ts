import { create } from "zustand";

/**
 * Whether someone has been past the front door before.
 *
 * The name is unchanged from when this belonged to the dismissible
 * first-run note the Help app replaced, and deliberately so: it is already
 * in real users' IndexedDB, and renaming it would greet every returning
 * visitor as new. `use-retire-orphaned-state` also writes it — see the
 * comment there.
 */
export const FIRST_RUN_DISMISSED_KEY = "first-run-note-dismissed";

/** A guide step the reader has actually run.
 *
 * Kept as a list of ids rather than a count, so reordering or removing a
 * step later cannot make someone's progress point at the wrong one.
 */
export interface HelpState {
  /** Guide step ids already run. */
  done: string[];
  /** Whether the action list is showing rather than the guide. Persisted, so
   * someone who has finished the guide and reopens Help for the actions
   * doesn't land back on step 1 every time. */
  showActions: boolean;
  markDone: (stepId: string) => void;
  setShowActions: (show: boolean) => void;
  resetGuide: () => void;
}

export const useHelpStore = create<HelpState>((set) => ({
  done: [],
  showActions: false,
  // Idempotent: a step re-run (they all stay clickable, since re-opening the
  // Event Explorer is a reasonable thing to want twice) must not duplicate.
  markDone: (stepId) =>
    set((s) => (s.done.includes(stepId) ? s : { done: [...s.done, stepId] })),
  setShowActions: (showActions) => set({ showActions }),
  resetGuide: () => set({ done: [], showActions: false }),
}));

/** Reads a stored Help state, tolerating anything that is not one.
 *
 * Same shape-validation rule as every other persisted store here: an entry
 * written by an older build falls back to defaults rather than handing the
 * component a `done` that is not an array of strings.
 */
export function parseHelpState(raw: string): Partial<HelpState> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const value = parsed as { done?: unknown; showActions?: unknown };
    const done =
      Array.isArray(value.done) && value.done.every((d) => typeof d === "string")
        ? (value.done as string[])
        : [];
    return { done, showActions: value.showActions === true };
  } catch {
    return null;
  }
}
