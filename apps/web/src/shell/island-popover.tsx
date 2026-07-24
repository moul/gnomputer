import { useEffect, useId, useRef, type ReactNode } from "react";
import { useIslandPopoverStore } from "./island-popover-store";

// A gap always exists between an island icon and the popover rendered below
// it (see shell.css) — moving the mouse from one to the other in a straight
// line briefly crosses whatever's underneath the pill (the desktop), which
// fires mouseleave on this wrapper before the cursor ever reaches the
// popover. A short grace period survives that crossing: closing is
// scheduled rather than immediate, and re-entering either the trigger or the
// popover within the window cancels it.
const CLOSE_GRACE_MS = 200;

export function IslandPopover({
  trigger,
  children,
  align = "right",
  disabled = false,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  /** True while overview mode is active (island-bar.tsx) — hovering
   * shouldn't pop up a menu over a desktop that's mid-transition, and any
   * already-open popover should snap shut rather than linger. */
  disabled?: boolean;
}) {
  const id = useId();
  // Only one island popover shows at a time (island-popover-store.ts) —
  // hovering a second icon while the first's close-grace-period is still
  // pending would otherwise leave both open briefly.
  const isOpen = useIslandPopoverStore((s) => s.openId === id);
  const setOpenId = useIslandPopoverStore((s) => s.setOpenId);
  const closeTimer = useRef<number | null>(null);

  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function show() {
    if (disabled) return;
    cancelClose();
    setOpenId(id);
  }

  function scheduleHide() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      // Only clear if this popover is still the one showing — a stale timer
      // from an already-abandoned hover shouldn't close whichever popover
      // opened after it.
      useIslandPopoverStore.setState((s) => (s.openId === id ? { openId: null } : s));
    }, CLOSE_GRACE_MS);
  }

  useEffect(() => cancelClose, []);
  useEffect(() => {
    if (disabled && isOpen) setOpenId(null);
  }, [disabled, isOpen, setOpenId]);

  return (
    <div className="island__popover-host" onMouseEnter={show} onMouseLeave={scheduleHide}>
      {trigger}
      {isOpen && (
        <div className="island__popover" data-align={align} role="menu">
          {children}
        </div>
      )}
    </div>
  );
}
