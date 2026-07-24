import { openSettings } from "./open-settings";

// No wallet connection exists yet (settings-user-tab.tsx), so this is
// permanently "Guest" for now — the copy is written so a future signed-in
// state only needs the label swapped, not the layout.
export function IslandProfileMenu() {
  return (
    <div className="island-menu">
      <p className="island-menu__title">Guest</p>
      <p className="island-menu__hint">Browsing without a wallet — read-only access.</p>
      <button type="button" className="island-menu__action" onClick={() => openSettings("user")}>
        Open Account →
      </button>
    </div>
  );
}
