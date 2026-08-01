import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useWindowStore, type WindowGeometry } from "./window-store";
import { useThemeStore } from "./theme-store";
import { iconForWindowId } from "./app-registry";
import { isPhoneViewport } from "./viewport";
import { desktopBounds } from "./desktop-bounds";
import { useZoomStore } from "./zoom-store";
import { useOverviewGeometry } from "./use-overview-geometry";
import { useShellStore } from "../store";
import { ErrorBoundary } from "./error-boundary";

export type WindowAccent = "cyan" | "amber" | "magenta" | "green" | "blue" | "red";

export function Window({
  id,
  title,
  defaultGeometry,
  accent = "cyan",
  startClosed = false,
  centeredPlacement = false,
  onClose,
  children,
}: {
  id: string;
  title: string;
  defaultGeometry: WindowGeometry;
  accent?: WindowAccent;
  startClosed?: boolean;
  /** Place at exactly defaultGeometry instead of the usual scatter. For the
   * window that forms the initial workspace, so a first visit looks the
   * same every time. */
  centeredPlacement?: boolean;
  /** Called instead of the normal close() when set — for windows that are
   * dynamically created instances (e.g. a popped-out realm browser) rather
   * than a fixed app, closing the titlebar button means "destroy this
   * instance" instead of "hide until reopened from the taskbar." */
  onClose?: () => void;
  children: ReactNode;
}) {
  const ensureWindow = useWindowStore((s) => s.ensureWindow);
  const focus = useWindowStore((s) => s.focus);
  const move = useWindowStore((s) => s.move);
  const resize = useWindowStore((s) => s.resize);
  const close = useWindowStore((s) => s.close);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const win = useWindowStore((s) => s.windows[id]);
  const overviewOpen = useWindowStore((s) => s.overviewOpen);
  const closeOverview = useWindowStore((s) => s.closeOverview);
  const isModern = useThemeStore((s) => s.theme.startsWith("modern"));
  const zoom = useZoomStore((s) => s.zoom);
  const isHoveredFromIsland = useShellStore((s) => s.hoveredWindowIds.includes(id));
  const isTopmost = useWindowStore((s) => {
    const zIndexes = Object.values(s.windows)
      .filter((w) => !w.closed)
      .map((w) => w.zIndex);
    return win !== undefined && win.zIndex === Math.max(...zIndexes);
  });

  useEffect(() => {
    // startMaximized only matters the first time this id is ever created —
    // ensureWindow no-ops for an id that already exists (including one
    // restored from a saved layout), so this never overrides a real user's
    // preference on any device, mobile or not.
    ensureWindow(id, title, defaultGeometry, {
      startClosed,
      startMaximized: isPhoneViewport(),
      centeredPlacement,
    });
    // Geometry is only ever applied once per window id — re-running this with
    // a fresh defaultGeometry object identity on every render must NOT reset a
    // window the user has already dragged or resized. Title updates (e.g. a
    // realm window's title changing package path) are handled inside
    // ensureWindow itself without touching geometry.
  }, [id, title]);

  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );
  const resizeState = useRef<{ startX: number; startY: number; originW: number; originH: number } | null>(
    null
  );

  useEffect(() => {
    // .desktop (not <html>) carries the zoom now, and pointermove listeners
    // here are on `window` — outside that zoom boundary — so real-pixel
    // mouse movement no longer maps 1:1 to the window's stored x/y/width/
    // height (all interpreted in .desktop's zoomed local coordinate space).
    // Dividing by zoom converts the real-pixel delta back to local units.
    function onPointerMove(e: PointerEvent) {
      if (dragState.current) {
        const { startX, startY, originX, originY } = dragState.current;
        move(id, originX + (e.clientX - startX) / zoom, originY + (e.clientY - startY) / zoom);
      } else if (resizeState.current) {
        const { startX, startY, originW, originH } = resizeState.current;
        resize(id, originW + (e.clientX - startX) / zoom, originH + (e.clientY - startY) / zoom);
      }
    }
    function onPointerUp() {
      dragState.current = null;
      resizeState.current = null;
      document.body.style.userSelect = "";
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [id, move, resize, zoom]);

  const overviewGeometry = useOverviewGeometry(id);

  if (!win || win.closed) return null;

  const geo = overviewGeometry ?? win;
  const isInteracting = dragState.current !== null || resizeState.current !== null;
  const style: CSSProperties & Record<`--${string}`, string> = {
    left: geo.x,
    top: geo.y,
    width: geo.width,
    height: geo.height,
    zIndex: win.zIndex,
    "--window-accent": `var(--accent-${accent})`,
    // The move/resize animation (shell.css) has to stay off while the user
    // is actively dragging or resizing — every pointermove already updates
    // win.x/y/width/height directly, and animating each of those tiny steps
    // would make the window visibly lag behind the cursor.
    transition: isInteracting ? "none" : undefined,
  };

  const classNames = ["window"];
  if (isTopmost) classNames.push("window--focused");
  else classNames.push("window--inactive");
  if (win.maximized) classNames.push("window--maximized");
  if (isHoveredFromIsland) classNames.push("window--island-hover");

  return (
    <div
      id={`window-${id}`}
      className={classNames.join(" ")}
      role="region"
      aria-label={title}
      style={style}
      onPointerDown={(e) => {
        // In overview mode, everything but this outer element has
        // pointer-events:none (styles/shell.css), so this fires for a click
        // anywhere on the window — "pick this one" exits overview too.
        // stopPropagation here (not on the later click) matters: the window
        // relocates the instant closeOverview() runs, snapping back to its
        // real position before the paired click event ever fires — by then
        // the desktop background's own pointerdown-to-toggle handler
        // (home.tsx) would see the cursor sitting over bare desktop and
        // reopen overview a beat after this window just closed it.
        e.stopPropagation();
        if (overviewOpen) closeOverview();
        focus(id);
      }}
    >
      <div
        className="window__content"
        style={
          overviewGeometry
            ? { width: win.width, height: win.height, zoom: overviewGeometry.scale }
            : undefined
        }
      >
        <div
          className="window__titlebar"
          // Focusable so a keyboard user can reach the window chrome at
          // all; arrow keys then move it and Shift+arrows resize it. Drag
          // and resize were otherwise pointer-only gestures.
          tabIndex={0}
          role="group"
          aria-label={`${title} window — arrow keys move, Shift+arrow keys resize`}
          onKeyDown={(e) => {
            const STEP = e.altKey ? 1 : 20;
            const deltas: Record<string, [number, number]> = {
              ArrowLeft: [-STEP, 0],
              ArrowRight: [STEP, 0],
              ArrowUp: [0, -STEP],
              ArrowDown: [0, STEP],
            };
            const delta = deltas[e.key];
            if (!delta) return;
            // A maximized window has no position or size of its own to
            // change; ignore rather than silently doing nothing surprising.
            if (win.maximized) return;
            e.preventDefault();
            if (e.shiftKey) resize(id, win.width + delta[0], win.height + delta[1]);
            else move(id, win.x + delta[0], win.y + delta[1]);
          }}
          onDoubleClick={() => toggleMaximize(id, desktopBounds())}
          onPointerDown={(e) => {
            if (win.maximized) return;
            dragState.current = { startX: e.clientX, startY: e.clientY, originX: win.x, originY: win.y };
            document.body.style.userSelect = "none";
          }}
        >
          <span className="window__controls">
            <button
              type="button"
              className="window__control window__control--close"
              aria-label={`Close ${title}`}
              onClick={() => (onClose ? onClose() : close(id))}
            >
              {/* Decorative: the accessible name is "Close <title>", and a
                  visible "[x]" that isn't part of that name is a
                  label-mismatch (flagged by Lighthouse). */}
              <span aria-hidden="true">{isModern ? "🔴" : "[x]"}</span>
            </button>
            {/* Maximize existed only as a titlebar double-click — a gesture
                with no keyboard equivalent at all (AUD-016). */}
            <button
              type="button"
              className="window__control window__control--maximize"
              aria-label={win.maximized ? `Restore ${title}` : `Maximize ${title}`}
              aria-pressed={win.maximized}
              onClick={() => toggleMaximize(id, desktopBounds())}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span aria-hidden="true">{isModern ? "🟢" : "[□]"}</span>
            </button>
          </span>
          <span className="window__title">
            <span className="window__title-icon" aria-hidden="true">
              {iconForWindowId(id)}
            </span>
            {title}
          </span>
        </div>
        <div className="window__body">
          {/* Each window body gets its own boundary so one app crashing
              takes down only that window — previously a render error in any
              app bubbled to the route-level boundary and replaced the whole
              desktop, losing every other open window with it. The inline
              fallback keeps the crash inside this window's frame. */}
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </div>
      {overviewGeometry && (
        <button
          type="button"
          className="window__overview-close"
          aria-label={`Close ${title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (onClose) onClose();
            else close(id);
          }}
        >
          ✕
        </button>
      )}
      {!win.maximized && (
        <div
          className="window__resize-handle"
          onPointerDown={(e) => {
            e.stopPropagation();
            focus(id);
            resizeState.current = {
              startX: e.clientX,
              startY: e.clientY,
              originW: win.width,
              originH: win.height,
            };
            document.body.style.userSelect = "none";
          }}
        />
      )}
    </div>
  );
}
