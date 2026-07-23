import { useThemeStore, THEME_ORDER, THEME_LABELS, type ThemeId } from "./theme-store";

const THEME_PREVIEW: Record<ThemeId, string> = {
  "ascii-dark": "◐",
  "ascii-light": "◑",
  "modern-light": "◈",
  "modern-dark": "◆",
};

const THEME_DESCRIPTION: Record<ThemeId, string> = {
  "ascii-dark": "Boxed corners, monospace chrome, dark background.",
  "ascii-light": "Same ASCII look, light background.",
  "modern-light": "Rounded windows, no ASCII glyphs, light background.",
  "modern-dark": "Rounded windows, no ASCII glyphs, dark background.",
};

export function SettingsThemeTab() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="settings-tab">
      <p className="settings-section-label">Theme</p>
      <div className="settings-theme-grid">
        {THEME_ORDER.map((id) => (
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
    </div>
  );
}
