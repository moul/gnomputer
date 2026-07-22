import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useWindowStore, type WindowGeometry } from "./window-store";

export type WindowAccent = "cyan" | "amber" | "magenta" | "green";

export function Window({
  id,
  title,
  defaultGeometry,
  accent = "cyan",
  children,
}: {
  id: string;
  title: string;
  defaultGeometry: WindowGeometry;
  accent?: WindowAccent;
  children: ReactNode;
}) {
  const ensureWindow = useWindowStore((s) => s.ensureWindow);
  const focus = useWindowStore((s) => s.focus);
  const move = useWindowStore((s) => s.move);
  const resize = useWindowStore((s) => s.resize);
  const close = useWindowStore((s) => s.close);
  const win = useWindowStore((s) => s.windows[id]);
  const isTopmost = useWindowStore((s) => {
    const zIndexes = Object.values(s.windows)
      .filter((w) => !w.closed)
      .map((w) => w.zIndex);
    return win !== undefined && win.zIndex === Math.max(...zIndexes);
  });

  useEffect(() => {
    ensureWindow(id, title, defaultGeometry);
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

  if (!win || win.closed) return null;

  const style: CSSProperties & Record<`--${string}`, string> = {
    left: win.x,
    top: win.y,
    width: win.width,
    height: win.height,
    zIndex: win.zIndex,
    "--window-accent": `var(--accent-${accent})`,
  };

  return (
    <div
      className={`window${isTopmost ? " window--focused" : ""}`}
      role="region"
      aria-label={title}
      style={style}
      onPointerDown={() => focus(id)}
    >
      <div
        className="window__titlebar"
        onPointerDown={(e) => {
          dragState.current = { startX: e.clientX, startY: e.clientY, originX: win.x, originY: win.y };
        }}
      >
        <span className="window__title">{title}</span>
        <button
          type="button"
          className="window__close"
          aria-label={`Close ${title}`}
          onClick={() => close(id)}
        >
          [x]
        </button>
      </div>
      <div className="window__body">{children}</div>
      <div
        className="window__resize-handle"
        onPointerDown={(e) => {
          e.stopPropagation();
          resizeState.current = { startX: e.clientX, startY: e.clientY, originW: win.width, originH: win.height };
        }}
      />
    </div>
  );
}
