import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { menuKeyAction } from "./menu-keys";
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
  /** Must be a single focusable element. It's cloned here to attach the
   * open/close handlers plus aria-expanded/aria-haspopup, so every island
   * icon gets keyboard and touch behaviour without repeating the wiring. */
  trigger: ReactElement;
  children: ReactNode;
  align?: "left" | "right";
  /** True while overview mode is active (island-bar.tsx) — hovering
   * shouldn't pop up a menu over a desktop that's mid-transition, and any
   * already-open popover should snap shut rather than linger. */
  disabled?: boolean;
}) {
  const id = useId();
  const panelId = `${id}-panel`;
  // Only one island popover shows at a time (island-popover-store.ts) —
  // hovering a second icon while the first's close-grace-period is still
  // pending would otherwise leave both open briefly.
  const isOpen = useIslandPopoverStore((s) => s.openId === id);
  const setOpenId = useIslandPopoverStore((s) => s.setOpenId);
  const closeTimer = useRef<number | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Whether the pointer is currently over the trigger. Used to keep
  // click-to-toggle from fighting hover: see the click handler below.
  const hoveringRef = useRef(false);
  // Set while focus is being returned to the trigger after Escape. The
  // trigger's onFocus opens the menu, so without this, Escape closed it and
  // the focus restore reopened it a moment later — the menu appeared not to
  // respond to Escape at all.
  const restoringFocusRef = useRef(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  const show = useCallback(() => {
    if (disabled || restoringFocusRef.current) return;
    cancelClose();
    setOpenId(id);
  }, [disabled, id, setOpenId]);

  const hideNow = useCallback(() => {
    cancelClose();
    useIslandPopoverStore.setState((s) => (s.openId === id ? { openId: null } : s));
  }, [id]);

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

  // Tap anywhere outside dismisses. Hover-only dismissal never worked on
  // touch, where there is no pointerleave to rely on.
  //
  // Listens for BOTH pointerdown and mousedown rather than pointerdown
  // alone: they overlap on a real browser (the second is a no-op once the
  // first has closed the menu), but some synthetic-input paths — including
  // Playwright's mouse, which is how this is regression-tested — emit only
  // mousedown, and a dismissal that silently depends on one event type is
  // exactly the kind of thing that rots unnoticed.
  useEffect(() => {
    if (!isOpen) return;
    function onOutside(e: Event) {
      const target = e.target as Node;
      if (hostRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      hideNow();
    }
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [isOpen, hideNow]);

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

  function focusTrigger() {
    restoringFocusRef.current = true;
    hostRef.current?.querySelector<HTMLElement>("button, [tabindex]")?.focus();
    // Released on the next task, once the focus event this call synchronously
    // dispatched has been handled. Anything the user does afterwards — click,
    // hover, Down — opens the menu again normally.
    window.setTimeout(() => {
      restoringFocusRef.current = false;
    }, 0);
  }

  function menuItems(): HTMLElement[] {
    const panel = panelRef.current;
    if (!panel) return [];
    return [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')];
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;

    // Opens the menu and enters it, which is how a keyboard user expects to
    // get in — before this, Down did nothing and the only way in was Tab.
    if (e.key === "ArrowDown" && hostRef.current?.contains(e.target as Node)) {
      const items = menuItems();
      if (items.length > 0) {
        e.preventDefault();
        items[0]!.focus();
        return;
      }
    }

    const items = menuItems();
    if (items.length === 0) {
      if (e.key === "Escape") {
        e.stopPropagation();
        hideNow();
        focusTrigger();
      }
      return;
    }

    const current = items.indexOf(document.activeElement as HTMLElement);
    const action = menuKeyAction(
      e.key,
      items.map((item) => item.textContent ?? ""),
      current
    );
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();
    if (action.close) {
      hideNow();
      focusTrigger();
      return;
    }
    if (action.focus !== undefined) items[action.focus]?.focus();
  }

  // Keyboard users open the menu by focusing the trigger, and it must stay
  // open while focus is anywhere inside it — including the portaled panel,
  // which is not a DOM descendant of the host.
  function onBlurCapture(e: React.FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (!next) return;
    if (hostRef.current?.contains(next) || panelRef.current?.contains(next)) return;
    scheduleHide();
  }

  const triggerProps = trigger.props as { onClick?: (e: React.MouseEvent) => void };
  const wiredTrigger = cloneElement(trigger, {
    "aria-haspopup": "menu",
    "aria-expanded": isOpen,
    "aria-controls": isOpen ? panelId : undefined,
    onFocus: show,
    onClick: (e: React.MouseEvent) => {
      triggerProps.onClick?.(e);
      // Tap-to-open, because touch has no hover and the whole island
      // navigation was otherwise unreachable there.
      //
      // Only toggles CLOSED when the menu wasn't opened by hovering. A
      // mouse user hovers (menu opens) and then clicks to run the trigger's
      // own action — closing the menu out from under that click would break
      // clicking straight through to an item, which is how these menus have
      // always been used. Tapping outside still dismisses on touch.
      if (isOpen && !hoveringRef.current) hideNow();
      else show();
    },
  } as Record<string, unknown>);

  return (
    <div
      className="island__popover-host"
      ref={hostRef}
      onMouseEnter={() => {
        hoveringRef.current = true;
        show();
      }}
      onMouseLeave={() => {
        hoveringRef.current = false;
        scheduleHide();
      }}
      onKeyDown={onKeyDown}
      onBlurCapture={onBlurCapture}
    >
      {wiredTrigger}
      {isOpen &&
        position &&
        createPortal(
          <div
            id={panelId}
            ref={panelRef}
            className="island__popover"
            // Still NOT role="menu", now for a different reason. Arrow
            // keys, Home/End and typeahead ARE implemented (menu-keys.ts).
            // But these panels hold titles, hints and labelled rows, and a
            // role="menu" may only contain menuitem/group/separator — so
            // claiming it would either be invalid or force hiding content
            // that is genuinely useful to read. A group of real buttons
            // with arrow-key navigation describes what this actually is.
            role="group"
            style={{ position: "fixed", top: position.top, left: position.left, right: position.right }}
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            onKeyDown={onKeyDown}
            onBlurCapture={onBlurCapture}
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}
