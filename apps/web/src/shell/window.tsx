import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useWindowStore, type WindowGeometry } from "./window-store";
import { useThemeStore } from "./theme-store";

export type WindowAccent = "cyan" | "amber" | "magenta" | "green" | "blue" | "red";

function desktopBounds(): { width: number; height: number } {
  const el = document.querySelector(".desktop");
  const rect = el?.getBoundingClientRect();
  return { width: rect?.width ?? window.innerWidth, height: rect?.height ?? window.innerHeight };
}

export function Window({
  id,
  title,
  defaultGeometry,
  accent = "cyan",
  startClosed = false,
  children,
}: {
  id: string;
  title: string;
  defaultGeometry: WindowGeometry;
  accent?: WindowAccent;
  startClosed?: boolean;
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
  const isModern = useThemeStore((s) => s.theme === "modern");
  const isTopmost = useWindowStore((s) => {
    const zIndexes = Object.values(s.windows)
      .filter((w) => !w.closed && !w.minimized)
      .map((w) => w.zIndex);
    return win !== undefined && win.zIndex === Math.max(...zIndexes);
  });

  useEffect(() => {
    ensureWindow(id, title, defaultGeometry, { startClosed });
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
    function onPointerMove(e: PointerEvent) {
      if (dragState.current) {
        const { startX, startY, originX, originY } = dragState.current;
        move(id, originX + (e.clientX - startX), originY + (e.clientY - startY));
      } else if (resizeState.current) {
        const { startX, startY, originW, originH } = resizeState.current;
        resize(id, originW + (e.clientX - startX), originH + (e.clientY - startY));
      }
    }
    function onPointerUp() {
      dragState.current = null;
      resizeState.current = null;
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [id, move, resize]);

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

  return (
    <div
      id={`window-${id}`}
      className={classNames.join(" ")}
      role="region"
      aria-label={title}
      style={style}
      onPointerDown={() => focus(id)}
    >
      <div
        className="window__titlebar"
        onDoubleClick={() => toggleMaximize(id, desktopBounds())}
        onPointerDown={(e) => {
          if (win.maximized) return;
          dragState.current = { startX: e.clientX, startY: e.clientY, originX: win.x, originY: win.y };
        }}
      >
        <span className="window__title">{title}</span>
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
            onClick={() => close(id)}
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
          }}
        />
      )}
    </div>
  );
}
