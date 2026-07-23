import { useFocusedWindow, useWindowStore } from "./window-store";
import { useNetworkStatus } from "./use-network-status";
import { openSettings } from "./open-settings";
import { useShellStore } from "../store";
import { useZoomStore, ZOOM_MIN, ZOOM_MAX } from "./zoom-store";

export function StatusBar() {
  const setCommandPaletteOpen = useShellStore((s) => s.setCommandPaletteOpen);
  const reopenWindow = useWindowStore((s) => s.reopen);
  const focused = useFocusedWindow();
  const { state, network } = useNetworkStatus();
  const zoom = useZoomStore((s) => s.zoom);
  const zoomIn = useZoomStore((s) => s.zoomIn);
  const zoomOut = useZoomStore((s) => s.zoomOut);
  const resetZoom = useZoomStore((s) => s.resetZoom);

  return (
    <header className="status-bar" role="banner">
      <div className="status-bar__left">
        <span className="status-bar__brand">Gnomputer</span>
        {focused && (
          <span className="status-bar__context" aria-live="polite">
            {focused.title}
          </span>
        )}
      </div>
      <button
        type="button"
        className="status-bar__search"
        onClick={() => setCommandPaletteOpen(true)}
        aria-label="Open command palette (Cmd+K)"
      >
        🔍 Search…
      </button>
      <div className="status-bar__right">
        <div className="status-bar__zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out"
          >
            −
          </button>
          <button type="button" onClick={resetZoom} title="Reset zoom" aria-label="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="status-bar__icon-button"
          data-state={state}
          onClick={() => openSettings("network")}
          title={`${network.name} — click for network settings`}
          aria-label="Network settings"
        >
          <span className="status-dot" data-state={state} aria-hidden="true" />
          {network.id}
        </button>
        <button
          type="button"
          className="status-bar__icon-button"
          onClick={() => openSettings("user")}
          title="Browsing as guest — click to view profile / connect"
          aria-label="User settings"
        >
          👤 guest
        </button>
        <button
          type="button"
          className="status-bar__icon-button status-bar__gear"
          onClick={() => reopenWindow("settings")}
          title="Settings"
          aria-label="Open settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
