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
  /** Other names this app answers to in the command palette.
   *
   * The app's own UI does not always use one name for it: the island's
   * Chain menu says "Blocks" while this registry says "Block Explorer", so
   * typing the word the user just read in the menu found nothing at all.
   * Aliases also cover the obvious near-misses — "wallet" for Accounts,
   * "repl" and "terminal" for Shell, "bookmarks" for Browser favorites.
   *
   * Ranked below label matches (palette-apps.ts), so an alias can never
   * outrank an app the user typed the real name of. */
  aliases?: string[];
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
  { id: "realm", label: "Browser", icon: "🌐", supportsMultiWindow: true, aliases: ["realm", "web", "render", "surf"] },
  { id: "resources", label: "Resources", icon: "📚", supportsMultiWindow: false },
  { id: "editor", label: "Editor", icon: "📝", supportsMultiWindow: false, aliases: ["write", "code", "ide", "scripts"] },
  { id: "shell", label: "Shell", icon: "⌨️", supportsMultiWindow: false, aliases: ["repl", "terminal", "console", "qeval", "eval"] },
  { id: "network-monitor", label: "Network Monitor", icon: "📡", supportsMultiWindow: false, group: "chain", aliases: ["rpc", "latency", "endpoint", "status"] },
  { id: "validator-monitor", label: "Validator Monitor", icon: "🛡️", supportsMultiWindow: false, group: "chain", aliases: ["validators", "valset", "consensus"] },
  { id: "block-explorer", label: "Block Explorer", icon: "🧱", supportsMultiWindow: false, group: "chain", aliases: ["blocks", "height"] },
  { id: "event-explorer", label: "Event Explorer", icon: "🔔", supportsMultiWindow: false, group: "chain", aliases: ["events", "feed", "live"] },
  { id: "chain-stats", label: "Chain Stats", icon: "⛽", supportsMultiWindow: false, group: "chain", aliases: ["gas", "leaderboard", "activity", "stats"] },
  { id: "gnockpit", label: "Gnockpit", icon: "📊", supportsMultiWindow: false, group: "chain" },
  { id: "settings", label: "Settings", icon: "⚙️", supportsMultiWindow: false, aliases: ["preferences", "config", "options"] },
  // Reachable via the clock's History menu (island-clock.tsx) instead of its
  // own icon — see AppDescriptor.hiddenFromIsland.
  { id: "history", label: "History", icon: "🕘", supportsMultiWindow: false, hiddenFromIsland: true, aliases: ["trail", "trails", "visited", "recent"] },
  // The generic "look up any address" viewer, opened contextually from
  // entity links (openRef) rather than from an island icon of its own.
  { id: "address", label: "Accounts", icon: "👤", supportsMultiWindow: false, hiddenFromIsland: true, aliases: ["address", "wallet", "balance", "account"] },
  // Discover isn't a real app of its own — it's a hover-only dropdown
  // (island-bar.tsx, hardcoded next to the Browser icon since it has no
  // single underlying window to focus-or-open) listing these five genuinely
  // independent apps, each with its own window. Each reachable only from
  // that dropdown, not its own island icon.
  { id: "users", label: "Users", icon: "👤", supportsMultiWindow: false, hiddenFromIsland: true, aliases: ["usernames", "registry", "names"] },
  // Realms and pure packages were one "Packages" list, which made the
  // thing most people are looking for (a realm to open) share a window
  // with the thing almost nobody browses directly (a library to import).
  // "packages" stays an alias on both so the old word still finds them.
  { id: "realms", label: "Realms", icon: "📦", supportsMultiWindow: false, hiddenFromIsland: true, aliases: ["realm", "packages", "deployed", "pkg", "apps"] },
  { id: "libraries", label: "Developer libraries", icon: "🧩", supportsMultiWindow: false, hiddenFromIsland: true, aliases: ["library", "libs", "packages", "pure", "imports", "dependencies"] },
  { id: "transactions", label: "Transactions", icon: "🧾", supportsMultiWindow: false, hiddenFromIsland: true, aliases: ["txs", "tx"] },
  { id: "tokens", label: "Tokens", icon: "🪙", supportsMultiWindow: false, hiddenFromIsland: true },
  { id: "governance", label: "Governance", icon: "🏛️", supportsMultiWindow: false, hiddenFromIsland: true, aliases: ["govdao", "dao", "proposals", "vote"] },
  // Dedicated windows for the real mygnoscan/Gnockpit instances — each
  // opened contextually from an "Open the explorer"/"Open Gnockpit" button
  // elsewhere in the app, not from an island icon of its own. Distinct app
  // identities rather than one generic "Embed" shell with a dynamic title.
  { id: "explorer", label: "Explorer", icon: "🧭", supportsMultiWindow: false, hiddenFromIsland: true },
  {
    id: "gnockpit-embed",
    label: "Gnockpit",
    icon: "📊",
    supportsMultiWindow: false,
    hiddenFromIsland: true,
  },
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
