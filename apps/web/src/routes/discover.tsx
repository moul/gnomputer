import { useDiscoverStore, type DiscoverTab } from "../shell/discover-store";
import { useStorePersistence } from "../shell/use-store-persistence";
import { Users } from "./users";
import { TransactionExplorer } from "./transaction-explorer";
import { DiscoverPackages } from "./discover-packages";
import { DiscoverTokens } from "./discover-tokens";
import { DiscoverGovernance } from "./discover-governance";

// "Discover" is the approachable, everyone-oriented counterpart to the
// Chain group (Network/Validator/Block/Event monitors — geekier, closer to
// the raw protocol). Users was previously its own island icon; it lives
// here now since looking someone up is itself a "discover" action, same
// as browsing packages, transactions, tokens, or proposals.
//
// Exported so the island Discover menu (island-discover-menu.tsx) can list
// the same tabs, with the same emoji, as its own hover popover — one
// source of truth, same pattern as SETTINGS_TABS.
export const DISCOVER_TABS: { id: DiscoverTab; emoji: string; label: string }[] = [
  { id: "users", emoji: "👤", label: "Users" },
  { id: "packages", emoji: "📦", label: "Packages" },
  { id: "transactions", emoji: "🧾", label: "Transactions" },
  { id: "tokens", emoji: "🪙", label: "Tokens" },
  { id: "governance", emoji: "🏛️", label: "Governance" },
];

export function Discover() {
  useStorePersistence("ui-state:discover", useDiscoverStore);
  const tab = useDiscoverStore((s) => s.tab);
  const setTab = useDiscoverStore((s) => s.setTab);

  return (
    <div className="discover-window">
      <div className="window-tabbar" role="tablist" aria-label="Discover">
        {DISCOVER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="window-tab"
            data-active={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      <div className="window-tabbody">
        {tab === "users" && <Users />}
        {tab === "packages" && <DiscoverPackages />}
        {tab === "transactions" && <TransactionExplorer />}
        {tab === "tokens" && <DiscoverTokens />}
        {tab === "governance" && <DiscoverGovernance />}
      </div>
    </div>
  );
}
