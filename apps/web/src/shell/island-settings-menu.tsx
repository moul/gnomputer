import { useThemeStore, THEME_LABELS } from "./theme-store";
import { useZoomStore, ZOOM_MIN, ZOOM_MAX } from "./zoom-store";
import { openSettings } from "./open-settings";
import { SETTINGS_TABS } from "./settings-window";

export function IslandSettingsMenu() {
  const theme = useThemeStore((s) => s.theme);
  const zoom = useZoomStore((s) => s.zoom);
  const zoomIn = useZoomStore((s) => s.zoomIn);
  const zoomOut = useZoomStore((s) => s.zoomOut);
  const resetZoom = useZoomStore((s) => s.resetZoom);

  return (
    <div className="island-menu">
      <p className="island-menu__title">Settings</p>
      <p className="island-menu__hint">
        Guest · {THEME_LABELS[theme]}
      </p>
      <div className="island-menu__row">
        <span className="island-menu__row-label">Zoom</span>
        <div className="island__zoom">
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
      </div>
      {SETTINGS_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="island-menu__action"
          onClick={() => openSettings(tab.id)}
        >
          {tab.emoji} {tab.label} →
        </button>
      ))}
    </div>
  );
}
