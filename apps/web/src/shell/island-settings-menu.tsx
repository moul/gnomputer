import { useThemeStore, THEME_LABELS } from "./theme-store";
import { useZoomStore, ZOOM_MIN, ZOOM_MAX } from "./zoom-store";
import { focusOrReopen } from "./open-ref";
import { generalBugReportUrl } from "./bug-report";
import { useSdk } from "../sdk-context";

export function IslandSettingsMenu() {
  const sdk = useSdk();
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
      <button type="button" className="island-menu__action" onClick={() => focusOrReopen("settings")}>
        Open Settings →
      </button>
      <a
        className="island-menu__action"
        href={generalBugReportUrl(sdk)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Report a bug ↗
      </a>
    </div>
  );
}
