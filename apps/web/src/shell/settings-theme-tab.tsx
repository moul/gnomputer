import { useThemeStore, THEME_LABELS, type ThemeId } from "./theme-store";
import { useZoomStore, ZOOM_MIN, ZOOM_MAX } from "./zoom-store";

// Display order for the grid — deliberately not THEME_ORDER (the cycle-button
// order): ASCII on top, Modern in the middle, both as light/dark
// pairs so that block reads as two clear axes; the two standalone opinionated
// themes (each a deliberate one-off, not part of a light/dark pair) go last.
// Every row keeps light on the left, dark on the right, including the last
// one — Minimal (light) then Cypherpunk (dark).
const THEME_GRID_ORDER: ThemeId[] = [
  "ascii-light",
  "ascii-dark",
  "modern-light",
  "modern-dark",
  "modern-minimal",
  "ascii-cypherpunk",
];

const THEME_PREVIEW: Record<ThemeId, string> = {
  "ascii-dark": "◐",
  "ascii-light": "◑",
  "modern-light": "◈",
  "modern-dark": "◆",
  "ascii-cypherpunk": "▓",
  "modern-minimal": "○",
};

const THEME_DESCRIPTION: Record<ThemeId, string> = {
  "ascii-dark": "Boxed corners, monospace chrome, dark background.",
  "ascii-light": "Same ASCII look, light background.",
  "modern-light": "Rounded windows, no ASCII glyphs, light background.",
  "modern-dark": "Rounded windows, no ASCII glyphs, dark background.",
  "ascii-cypherpunk": "ANSI-bright green-on-black terminal, loud on purpose.",
  "modern-minimal": "Near-grayscale and quiet, light background.",
};

export function SettingsThemeTab() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const zoom = useZoomStore((s) => s.zoom);
  const zoomIn = useZoomStore((s) => s.zoomIn);
  const zoomOut = useZoomStore((s) => s.zoomOut);
  const resetZoom = useZoomStore((s) => s.resetZoom);

  return (
    <div className="settings-tab">
      <p className="settings-section-label">Theme</p>
      <div className="settings-theme-grid">
        {THEME_GRID_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className="settings-theme-option"
            data-active={theme === id}
            onClick={() => setTheme(id)}
          >
            <span className="settings-theme-option__glyph" aria-hidden="true">
              {THEME_PREVIEW[id]}
            </span>
            <span className="settings-theme-option__label">{THEME_LABELS[id]}</span>
            <span className="settings-theme-option__description">{THEME_DESCRIPTION[id]}</span>
          </button>
        ))}
      </div>

      <p className="settings-section-label">Zoom</p>
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
  );
}
