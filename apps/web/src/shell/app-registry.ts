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
  /** Reachable only via another entry point (a trail step, an entity link,
   * the clock's History menu) rather than its own island icon — the window
   * itself still exists and renders normally in home.tsx. */
  hiddenFromIsland?: boolean;
}

export interface IslandGroup {
  label: string;
  icon: string;
  /** The member app id opened when none of the group's windows are open. */
  defaultId: string;
}

export const ISLAND_GROUPS: Record<string, IslandGroup> = {
  chain: { label: "Chain", icon: "📡", defaultId: "network-monitor" },
};

// The static, always-present set of apps — one entry per app *type*, not per
// open window instance. Single-instance apps are brought to front on click;
// a multi-window one focuses its most recently active window (new instances
// come from an in-app "pop out" action, not from repeated icon clicks).
export const APP_REGISTRY: AppDescriptor[] = [
  { id: "realm", label: "Browser", icon: "🌐", supportsMultiWindow: true },
  // The approachable, everyone-oriented counterpart to the Chain group —
  // users, packages, transactions, tokens, and governance, as tabs of one
  // window (discover.tsx) rather than separate icons. Users used to be its
  // own icon; it's a Discover tab now.
  { id: "discover", label: "Discover", icon: "🔭", supportsMultiWindow: false },
  { id: "resources", label: "Resources", icon: "📚", supportsMultiWindow: false },
  { id: "editor", label: "Editor", icon: "📝", supportsMultiWindow: false },
  { id: "shell", label: "Shell", icon: "⌨️", supportsMultiWindow: false },
  { id: "network-monitor", label: "Network Monitor", icon: "📡", supportsMultiWindow: false, group: "chain" },
  { id: "validator-monitor", label: "Validator Monitor", icon: "🛡️", supportsMultiWindow: false, group: "chain" },
  { id: "block-explorer", label: "Block Explorer", icon: "🧱", supportsMultiWindow: false, group: "chain" },
  { id: "event-explorer", label: "Event Explorer", icon: "🔔", supportsMultiWindow: false, group: "chain" },
  { id: "gnockpit", label: "Gnockpit", icon: "📊", supportsMultiWindow: false, group: "chain" },
  { id: "settings", label: "Settings", icon: "⚙️", supportsMultiWindow: false },
  // Reachable via the clock's History menu (island-clock.tsx) instead of its
  // own icon — see AppDescriptor.hiddenFromIsland.
  { id: "history", label: "History", icon: "🕘", supportsMultiWindow: false, hiddenFromIsland: true },
  // The generic "look up any address" viewer, opened contextually from
  // entity links (openRef) rather than from an island icon of its own.
  { id: "address", label: "Accounts", icon: "👤", supportsMultiWindow: false, hiddenFromIsland: true },
  // Shows a curated third-party tool (mygnoscan, Gnockpit) inline via
  // iframe — opened contextually from an "Embed" button next to that
  // tool's existing external link, not from an island icon of its own.
  { id: "embed", label: "Embed", icon: "🖼️", supportsMultiWindow: false, hiddenFromIsland: true },
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
