import { useEffect, useState } from "react";
import { AccountExplorer } from "../routes/account-explorer";
import { usePendingRefsStore } from "./pending-refs-store";

const EXAMPLE_ADDRESS = "g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5";

export function SettingsUserTab() {
  const [address, setAddress] = useState(EXAMPLE_ADDRESS);
  const [draftAddress, setDraftAddress] = useState(EXAMPLE_ADDRESS);
  const pendingAddress = usePendingRefsStore((s) => s.pendingAddress);

  useEffect(() => {
    if (!pendingAddress) return;
    setAddress(pendingAddress);
    setDraftAddress(pendingAddress);
    usePendingRefsStore.getState().setPendingAddress(null);
  }, [pendingAddress]);

  return (
    <div className="settings-tab">
      <div className="settings-user-identity">
        <span className="settings-user-identity__emoji" aria-hidden="true">
          🔌
        </span>
        <div>
          <p className="settings-user-identity__label">Guest</p>
          <p className="settings-user-identity__hint">Browsing without a wallet — read-only access.</p>
        </div>
        <button type="button" disabled title="Wallet connection isn't available yet">
          Connect
        </button>
      </div>

      <form
        className="open-package-form"
        onSubmit={(e) => {
          e.preventDefault();
          setAddress(draftAddress);
        }}
      >
        <label>
          Look up an account
          <input
            value={draftAddress}
            onChange={(e) => setDraftAddress(e.target.value)}
            placeholder="g1..."
          />
        </label>
        <button type="submit">Open</button>
      </form>
      <AccountExplorer address={address} />
    </div>
  );
}
