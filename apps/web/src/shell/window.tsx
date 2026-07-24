import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useWindowStore, type WindowGeometry } from "./window-store";
import { useThemeStore } from "./theme-store";
import { iconForWindowId } from "./app-registry";
import { isPhoneViewport } from "./viewport";
import { desktopBounds } from "./desktop-bounds";
import { useZoomStore } from "./zoom-store";
import { useShellStore } from "../store";

export type WindowAccent = "cyan" | "amber" | "magenta" | "green" | "blue" | "red";

export function Window({
  id,
  title,
  defaultGeometry,
  accent = "cyan",
  startClosed = false,
  onClose,
  children,
}: {
  id: string;
  title: string;
  defaultGeometry: WindowGeometry;
  accent?: WindowAccent;
  startClosed?: boolean;
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
  const minimize = useWindowStore((s) => s.minimize);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const win = useWindowStore((s) => s.windows[id]);
  const overviewOpen = useWindowStore((s) => s.overviewOpen);
  const closeOverview = useWindowStore((s) => s.closeOverview);
  const isModern = useThemeStore((s) => s.theme.startsWith("modern"));
  const zoom = useZoomStore((s) => s.zoom);
  const isHoveredFromIsland = useShellStore((s) => s.hoveredWindowIds.includes(id));
  const isTopmost = useWindowStore((s) => {
    const zIndexes = Object.values(s.windows)
      .filter((w) => !w.closed && !w.minimized)
      .map((w) => w.zIndex);
    return win !== undefined && win.zIndex === Math.max(...zIndexes);
  });

  useEffect(() => {
    // startMaximized only matters the first time this id is ever created —
    // ensureWindow no-ops for an id that already exists (including one
    // restored from a saved layout), so this never overrides a real user's
    // preference on any device, mobile or not.
    ensureWindow(id, title, defaultGeometry, { startClosed, startMaximized: isPhoneViewport() });
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

  if (!win || win.closed || win.minimized) return null;

  const style: CSSProperties & Record<`--${string}`, string> = {
    left: win.x,
    top: win.y,
    width: win.width,
    height: win.height,
    zIndex: win.zIndex,
    "--window-accent": `var(--accent-${accent})`,
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
      onPointerDown={() => {
        // In overview mode, everything but this outer element has
        // pointer-events:none (styles/shell.css), so this fires for a click
        // anywhere on the window — "pick this one" exits overview too.
        if (overviewOpen) closeOverview();
        focus(id);
      }}
    >
      <div
        className="window__titlebar"
        onDoubleClick={() => toggleMaximize(id, desktopBounds())}
        onPointerDown={(e) => {
          if (win.maximized) return;
          dragState.current = { startX: e.clientX, startY: e.clientY, originX: win.x, originY: win.y };
          document.body.style.userSelect = "none";
        }}
      >
        <span className="window__title">
          <span className="window__title-icon" aria-hidden="true">
            {iconForWindowId(id)}
          </span>
          {title}
        </span>
        <span className="window__controls">
          <button
            type="button"
            className="window__control"
            aria-label={`Minimize ${title}`}
            onClick={() => minimize(id)}
          >
            {isModern ? "🟡" : "[_]"}
          </button>
          <button
            type="button"
            className="window__control"
            aria-label={win.maximized ? `Restore ${title}` : `Maximize ${title}`}
            onClick={() => toggleMaximize(id, desktopBounds())}
          >
            {isModern ? "🟢" : win.maximized ? "[❐]" : "[□]"}
          </button>
          <button
            type="button"
            className="window__control window__control--close"
            aria-label={`Close ${title}`}
            onClick={() => (onClose ? onClose() : close(id))}
          >
            {isModern ? "🔴" : "[x]"}
          </button>
        </span>
      </div>
      <div className="window__body">{children}</div>
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
