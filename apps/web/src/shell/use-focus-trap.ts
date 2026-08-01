import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "details summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    // offsetParent is null for display:none subtrees; a hidden control must
    // not be a Tab stop inside the trap.
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/** Keeps Tab inside a modal while it's open, and returns focus to whatever
 * opened it on close.
 *
 * The dialogs here declared `role="dialog" aria-modal="true"` but nothing
 * constrained Tab, so focus walked straight out into the windows behind
 * them — and on close it was dropped on <body>, forcing keyboard users to
 * traverse from the top again (AUD-019).
 *
 * Returns a ref to attach to the dialog element. */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const lastOutside = useRef<HTMLElement | null>(null);
  // Assigned during RENDER, not in an effect: a dialog's autoFocus fires
  // during commit, which is before the ref below is attached — so a
  // containment check would see ref.current === null and record the
  // dialog's own input as "outside". Knowing the dialog is open by then is
  // what makes the distinction reliable.
  const activeRef = useRef(active);
  activeRef.current = active;

  // Reading document.activeElement inside the open-effect is too late: a
  // dialog whose first field has autoFocus (the command palette) has
  // already moved focus by commit time, so the effect would capture the
  // dialog's own input and "restore" to a removed node — focus ends up on
  // <body>, which is the bug this hook exists to prevent. Track the last
  // element focused OUTSIDE the dialog instead.
  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (activeRef.current || ref.current?.contains(target)) return;
      lastOutside.current = target;
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    restoreTo.current = lastOutside.current;

    // Focus the first control rather than leaving focus outside the dialog
    // it just opened — an aria-modal with focus still behind it is a lie.
    const initial = focusableWithin(root)[0];
    initial?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !root) return;
      const items = focusableWithin(root);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement;

      // Wrap at both ends. Also catches the case where focus has somehow
      // escaped the dialog already — pull it back in rather than letting
      // Tab continue into the page behind.
      if (e.shiftKey && (current === first || !root.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !root.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Only restore if focus is still somewhere in (or lost from) the
      // dialog — if something else deliberately took focus, don't steal it.
      const active = document.activeElement;
      if (!active || active === document.body || ref.current?.contains(active)) {
        restoreTo.current?.focus();
      }
    };
  }, [active]);

  return ref;
}
