import { useEffect, useState } from "react";
import { useWindowStore } from "./window-store";
import { useRealmTabsStore } from "./realm-tabs-store";
import { useNetworkStatus } from "./use-network-status";
import { APP_REGISTRY, ISLAND_GROUPS } from "./app-registry";
import { focusFamilyOrOpenDefault, realmFamilyIds } from "./focus-family";
import { useZoomStore, ZOOM_MIN, ZOOM_MAX } from "./zoom-store";
import { useShellStore } from "../store";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// One entry per island icon — apps sharing a `group` (app-registry.ts)
// collapse into a single icon here, so 11 registered apps read as ~7
// distinct island slots.
interface IslandIcon {
  key: string;
  label: string;
  icon: string;
  memberIds: string[];
  defaultId: string;
  supportsMultiWindow: boolean;
}

function buildIslandIcons(): IslandIcon[] {
  const seenGroups = new Set<string>();
  const icons: IslandIcon[] = [];
  for (const app of APP_REGISTRY) {
    if (app.group) {
      if (seenGroups.has(app.group)) continue;
      seenGroups.add(app.group);
      const group = ISLAND_GROUPS[app.group]!;
      const memberIds = APP_REGISTRY.filter((a) => a.group === app.group).map((a) => a.id);
      icons.push({
        key: app.group,
        label: group.label,
        icon: group.icon,
        memberIds,
        defaultId: group.defaultId,
        supportsMultiWindow: false,
      });
    } else {
      icons.push({
        key: app.id,
        label: app.label,
        icon: app.icon,
        memberIds: [app.id],
        defaultId: app.id,
        supportsMultiWindow: app.supportsMultiWindow,
      });
    }
  }
  return icons;
}

const ISLAND_ICONS = buildIslandIcons();

export function IslandBar() {
  const windows = useWindowStore((s) => s.windows);
  const focus = useWindowStore((s) => s.focus);
  const restore = useWindowStore((s) => s.restore);
  const reopen = useWindowStore((s) => s.reopen);
  const createNewRealmWindow = useRealmTabsStore((s) => s.createNewWindow);
  const setCommandPaletteOpen = useShellStore((s) => s.setCommandPaletteOpen);
  const setHoveredWindowIds = useShellStore((s) => s.setHoveredWindowIds);
  const zoom = useZoomStore((s) => s.zoom);
  const zoomIn = useZoomStore((s) => s.zoomIn);
  const zoomOut = useZoomStore((s) => s.zoomOut);
  const resetZoom = useZoomStore((s) => s.resetZoom);
  const { data, state } = useNetworkStatus();
  const [now, setNow] = useState(() => new Date());
  const [clockHover, setClockHover] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  function scrollToWindow(id: string) {
    document
      .getElementById(`window-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }

  function openIcon(icon: IslandIcon) {
    if (icon.supportsMultiWindow) {
      const familyIds = realmFamilyIds(windows);
      const anyOpen = familyIds.some((id) => windows[id] && !windows[id]!.closed);
      if (!anyOpen) {
        const newId = createNewRealmWindow();
        requestAnimationFrame(() => scrollToWindow(newId));
        return;
      }
      const focusedId = focusFamilyOrOpenDefault(familyIds, icon.defaultId, windows, {
        focus,
        restore,
        reopen,
      });
      scrollToWindow(focusedId);
      return;
    }
    const focusedId = focusFamilyOrOpenDefault(icon.memberIds, icon.defaultId, windows, {
      focus,
      restore,
      reopen,
    });
    scrollToWindow(focusedId);
  }

  function isOpen(icon: IslandIcon): boolean {
    if (icon.supportsMultiWindow) {
      return realmFamilyIds(windows).some((id) => windows[id] && !windows[id]!.closed);
    }
    return icon.memberIds.some((id) => windows[id] && !windows[id]!.closed);
  }

  function hoverIds(icon: IslandIcon): string[] {
    return icon.supportsMultiWindow ? realmFamilyIds(windows) : icon.memberIds;
  }

  return (
    <div className="island" role="toolbar" aria-label="Apps">
      <span className="island__brand" aria-hidden="true">
        ⌘
      </span>
      <button
        type="button"
        className="island__icon"
        aria-label="Open command palette (Cmd+K)"
        title="Search (⌘K)"
        onClick={() => setCommandPaletteOpen(true)}
      >
        🔍
      </button>
      <span className="island__divider" aria-hidden="true" />
      {ISLAND_ICONS.map((icon) => (
        <button
          key={icon.key}
          type="button"
          className="island__icon"
          data-open={isOpen(icon)}
          title={icon.label}
          aria-label={icon.label}
          onClick={() => openIcon(icon)}
          onMouseEnter={() => setHoveredWindowIds(hoverIds(icon))}
          onMouseLeave={() => setHoveredWindowIds([])}
        >
          {icon.icon}
          {isOpen(icon) && <span className="island__icon-dot" aria-hidden="true" />}
        </button>
      ))}
      <span className="island__divider" aria-hidden="true" />
      <div className="island__zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={resetZoom} title="Reset zoom" aria-label="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
          +
        </button>
      </div>
      <div
        className="island__clock"
        onMouseEnter={() => setClockHover(true)}
        onMouseLeave={() => setClockHover(false)}
      >
        <span className="status-dot" data-state={state} aria-hidden="true" />
        {formatClock(now)}
        {clockHover && (
          <div className="island__clock-popover" role="tooltip">
            <div className="island__clock-popover-time">{formatClock(now)}</div>
            <div className="island__clock-popover-date">
              {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <dl className="island__clock-popover-stats">
              <dt>Chain</dt>
              <dd>{data?.chainId ?? "—"}</dd>
              <dt>Height</dt>
              <dd>{data ? `#${data.latestHeight}` : "—"}</dd>
              <dt>Latency</dt>
              <dd>{data ? `${data.latencyMs}ms` : "—"}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
