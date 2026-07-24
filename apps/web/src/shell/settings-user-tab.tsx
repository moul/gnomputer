import { useState } from "react";
import { openRef } from "./open-ref";

export function SettingsUserTab() {
  const [draftAddress, setDraftAddress] = useState("");

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
          if (draftAddress === "") return;
          openRef(`gno://_/address/${draftAddress}`);
        }}
      >
        <label>
          Look up an account
          <input
            type="text"
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            value={draftAddress}
            onChange={(e) => setDraftAddress(e.target.value)}
            placeholder="g1..."
          />
        </label>
        <button type="submit">Open</button>
      </form>
    </div>
  );
}
