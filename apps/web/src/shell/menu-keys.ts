export interface MenuKeyAction {
  /** Index to move focus to. */
  focus?: number;
  close?: boolean;
}

/** Arrow-key navigation over a flat list of menu items, as a pure function.
 *
 * The island menus were Tab-only: reachable, but you walked through every
 * item of every menu in document order rather than moving within the one
 * you opened (AUD-014).
 *
 * `null` means the key isn't ours, so the caller leaves it alone — Tab in
 * particular must keep working normally, since these items are real buttons
 * in the tab order and always have been. */
export function menuKeyAction(
  key: string,
  labels: readonly string[],
  currentIndex: number
): MenuKeyAction | null {
  if (labels.length === 0) return null;
  const last = labels.length - 1;

  switch (key) {
    case "ArrowDown":
      // Wraps, unlike the tree. A menu is a short closed list and wrapping
      // is what the APG menu pattern specifies; a tree is a long structure
      // where wrapping loses your place.
      return { focus: currentIndex >= last ? 0 : currentIndex + 1 };
    case "ArrowUp":
      return { focus: currentIndex <= 0 ? last : currentIndex - 1 };
    case "Home":
      return { focus: 0 };
    case "End":
      return { focus: last };
    case "Escape":
      return { close: true };
    default: {
      if (key.length !== 1 || !/\S/.test(key)) return null;
      const lower = key.toLowerCase();
      // Search after the current item and wrap, so pressing the same letter
      // repeatedly cycles through the items that start with it.
      const order = [
        ...labels.slice(currentIndex + 1).map((label, i) => [label, currentIndex + 1 + i] as const),
        ...labels.slice(0, currentIndex + 1).map((label, i) => [label, i] as const),
      ];
      const match = order.find(([label]) => label.trim().toLowerCase().startsWith(lower));
      return match ? { focus: match[1] } : null;
    }
  }
}
