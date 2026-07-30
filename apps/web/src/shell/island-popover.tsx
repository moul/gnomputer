import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIslandPopoverStore } from "./island-popover-store";

// A gap always exists between an island icon and the popover rendered below
// it (see shell.css) — moving the mouse from one to the other in a straight
// line briefly crosses whatever's underneath the pill (the desktop), which
// fires mouseleave on this wrapper before the cursor ever reaches the
// popover. A short grace period survives that crossing: closing is
// scheduled rather than immediate, and re-entering either the trigger or the
// popover within the window cancels it.
const CLOSE_GRACE_MS = 200;

// Mirrors --space-2 in theme.css — CSS can't import this, so it's kept in
// sync by hand (same pattern as ISLAND_CLEARANCE_PX in viewport.ts).
const POPOVER_GAP_PX = 8;

interface PopoverPosition {
  top: number;
  left?: number;
  right?: number;
}

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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

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

  // Rendered via a portal straight into <body> (below), not as a normal
  // child of .island__popover-host — .island itself scrolls horizontally on
  // a narrow viewport (shell.css), and any scrolling ancestor clips an
  // absolutely-positioned descendant that visually extends past its own
  // box, which a dropdown opening below a ~40px-tall pill always does.
  // Position is computed from the trigger's real screen position instead of
  // plain CSS top/left/right so it still lands in the right place once it's
  // no longer a descendant of .island__popover-host.
  useLayoutEffect(() => {
    if (!isOpen || !hostRef.current) {
      setPosition(null);
      return;
    }
    const rect = hostRef.current.getBoundingClientRect();
    setPosition(
      align === "left"
        ? { top: rect.bottom + POPOVER_GAP_PX, left: rect.left }
        : { top: rect.bottom + POPOVER_GAP_PX, right: window.innerWidth - rect.right }
    );
  }, [isOpen, align]);

  return (
    <div className="island__popover-host" ref={hostRef} onMouseEnter={show} onMouseLeave={scheduleHide}>
      {trigger}
      {isOpen &&
        position &&
        createPortal(
          <div
            className="island__popover"
            role="menu"
            style={{ position: "fixed", top: position.top, left: position.left, right: position.right }}
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}
