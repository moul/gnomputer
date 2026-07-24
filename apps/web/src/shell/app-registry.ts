export interface AppDescriptor {
  /** The fixed window id for single-instance apps, or the primary/template
   * id for multi-window ones (e.g. "realm" — pop-outs get "realm-1", "realm-2"). */
  id: string;
  label: string;
  icon: string;
  supportsMultiWindow: boolean;
}

// The static, always-present set of apps — one entry per app *type*, not per
// open window instance. This is what the Apps start-menu launches from: a
// single-instance app is brought to front, a multi-window one always opens
// a fresh instance (like clicking an app in a real OS's start menu/dock).
export const APP_REGISTRY: AppDescriptor[] = [
  { id: "realm", label: "Realm Browser", icon: "🌐", supportsMultiWindow: true },
  { id: "network-monitor", label: "Network Monitor", icon: "📡", supportsMultiWindow: false },
  { id: "validator-monitor", label: "Validator Monitor", icon: "🛡️", supportsMultiWindow: false },
  { id: "block-explorer", label: "Block Explorer", icon: "🧱", supportsMultiWindow: false },
  { id: "event-explorer", label: "Event Explorer", icon: "🔔", supportsMultiWindow: false },
  { id: "gnockpit", label: "Gnockpit", icon: "📊", supportsMultiWindow: false },
  { id: "settings", label: "Settings", icon: "⚙️", supportsMultiWindow: false },
  { id: "history", label: "History", icon: "🕘", supportsMultiWindow: false },
  { id: "address", label: "User Info", icon: "👤", supportsMultiWindow: false },
];

const ICON_BY_ID = new Map(APP_REGISTRY.map((app) => [app.id, app.icon]));

/** Icon for a specific window instance — used in titlebars and the "open
 * windows" row, where each instance still shows its own dynamic title. */
export function iconForWindowId(id: string): string {
  if (ICON_BY_ID.has(id)) return ICON_BY_ID.get(id)!;
  if (id.startsWith("realm-")) return ICON_BY_ID.get("realm")!;
  return "🪟";
}
