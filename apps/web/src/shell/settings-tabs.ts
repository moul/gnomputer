import type { SettingsTab } from "./settings-store";

/** Single source of truth for a tab's emoji + label — the island Settings
 * dropdown (island-settings-menu.tsx) mirrors this list so every dropdown
 * entry matches its in-window tab exactly, one entry each, no duplicates.
 *
 * In its own module rather than beside the window component. The island menu
 * needs this list on every page load, and importing it from
 * settings-window.tsx dragged all seven tab components into the main chunk
 * with it — so the Settings app could not be lazy-loaded like every other
 * app, and everyone paid for it on first visit whether or not they ever
 * opened Settings. */
export const SETTINGS_TABS: { id: SettingsTab; emoji: string; label: string }[] = [
  { id: "network", emoji: "📡", label: "Network" },
  { id: "user", emoji: "👤", label: "User" },
  { id: "theme", emoji: "🎨", label: "Theme" },
  { id: "storage", emoji: "💾", label: "Storage" },
  { id: "bug", emoji: "🐛", label: "Report a bug" },
  { id: "changelog", emoji: "📜", label: "Changelog" },
  { id: "about", emoji: "ℹ️", label: "About" },
];

export const TAB_LABEL: Record<SettingsTab, string> = Object.fromEntries(
  SETTINGS_TABS.map((t) => [t.id, t.label])
) as Record<SettingsTab, string>;
