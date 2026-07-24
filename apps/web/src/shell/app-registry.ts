export interface AppDescriptor {
  /** The fixed window id for single-instance apps, or the primary/template
   * id for multi-window ones (e.g. "realm" — pop-outs get "realm-1", "realm-2"). */
  id: string;
  label: string;
  icon: string;
  supportsMultiWindow: boolean;
  /** Apps sharing a group render as ONE island icon (island-bar.tsx) —
   * clicking it focuses whichever member was most recently active, or
   * opens the group's default member if none are open. */
  group?: string;
}

export interface IslandGroup {
  label: string;
  icon: string;
  /** The member app id opened when none of the group's windows are open. */
  defaultId: string;
}

export const ISLAND_GROUPS: Record<string, IslandGroup> = {
  chain: { label: "Chain", icon: "📡", defaultId: "network-monitor" },
  profile: { label: "Profile", icon: "👤", defaultId: "settings" },
};

// The static, always-present set of apps — one entry per app *type*, not per
// open window instance. Single-instance apps are brought to front on click;
// a multi-window one focuses its most recently active window (new instances
// come from an in-app "pop out" action, not from repeated icon clicks).
export const APP_REGISTRY: AppDescriptor[] = [
  { id: "realm", label: "Browser", icon: "🌐", supportsMultiWindow: true },
  { id: "world-explorer", label: "World Explorer", icon: "🌍", supportsMultiWindow: false },
  { id: "users", label: "Users", icon: "🧑‍🤝‍🧑", supportsMultiWindow: false },
  { id: "network-monitor", label: "Network Monitor", icon: "📡", supportsMultiWindow: false, group: "chain" },
  { id: "validator-monitor", label: "Validator Monitor", icon: "🛡️", supportsMultiWindow: false, group: "chain" },
  { id: "block-explorer", label: "Block Explorer", icon: "🧱", supportsMultiWindow: false, group: "chain" },
  { id: "event-explorer", label: "Event Explorer", icon: "🔔", supportsMultiWindow: false, group: "chain" },
  { id: "gnockpit", label: "Gnockpit", icon: "📊", supportsMultiWindow: false, group: "chain" },
  { id: "settings", label: "Settings", icon: "⚙️", supportsMultiWindow: false, group: "profile" },
  { id: "history", label: "History", icon: "🕘", supportsMultiWindow: false },
  { id: "address", label: "User Info", icon: "👤", supportsMultiWindow: false, group: "profile" },
];

const ICON_BY_ID = new Map(APP_REGISTRY.map((app) => [app.id, app.icon]));

/** Icon for a specific window instance — used in titlebars and the
 * overview-mode grid, where each instance still shows its own dynamic
 * title, unlike the island's one-icon-per-group. */
export function iconForWindowId(id: string): string {
  if (ICON_BY_ID.has(id)) return ICON_BY_ID.get(id)!;
  if (id.startsWith("realm-")) return ICON_BY_ID.get("realm")!;
  return "🪟";
}
