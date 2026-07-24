import { useEffect, useRef, useState, type ReactNode } from "react";

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
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function show() {
    cancelClose();
    setOpen(true);
  }

  function scheduleHide() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_GRACE_MS);
  }

  useEffect(() => cancelClose, []);

  return (
    <div className="island__popover-host" onMouseEnter={show} onMouseLeave={scheduleHide}>
      {trigger}
      {open && (
        <div className="island__popover" data-align={align} role="menu">
          {children}
        </div>
      )}
    </div>
  );
}
