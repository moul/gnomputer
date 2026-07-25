import { useState } from "react";
import { useSdk } from "../sdk-context";
import { useWalletStore } from "./wallet-store";
import {
  connectWallet,
  connectManualAddress,
  disconnectWallet,
  isAdenaInstalled,
  isValidGnoAddress,
  ADENA_INSTALL_URL,
} from "./wallet-connect";
import { QrCode } from "./qr-code";

function formatUgnot(coins: string): string {
  const match = /^(\d+)ugnot$/.exec(coins.trim());
  if (!match) return coins;
  return `${(Number(match[1]) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} GNOT`;
}

export function SettingsUserTab() {
  const account = useWalletStore((s) => s.account);

  if (account) {
    return (
      <div className="settings-tab">
        <div className="settings-user-identity">
          <span className="settings-user-identity__emoji" aria-hidden="true">
            🟢
          </span>
          <div>
            <p className="settings-user-identity__label">
              {account.source === "adena" ? "Connected via Adena" : "Connected via gnokey (manual address)"}
            </p>
            <p className="settings-user-identity__hint">{account.address}</p>
          </div>
          <button type="button" onClick={disconnectWallet}>
            Disconnect
          </button>
        </div>
        <dl className="account-fields">
          <dt>Address</dt>
          <dd>{account.address}</dd>
          <dt>Balance</dt>
          <dd>{formatUgnot(account.coins)}</dd>
          <dt>Chain</dt>
          <dd>{account.chainId}</dd>
        </dl>
        {account.source === "manual" && (
          <p className="state-line">
            Gnomputer only knows this address — it can&rsquo;t sign transactions for you. Actions
            that need a signature will offer a real gnoweb link + QR to complete with gnokey.
          </p>
        )}
      </div>
    );
  }

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
      </div>
      <AdenaConnect />
      <GnokeyConnect />
      <WalletError />
    </div>
  );
}

function WalletError() {
  const error = useWalletStore((s) => s.error);
  if (!error) return null;
  return <p className="settings-user-identity__error">{error}</p>;
}

function AdenaConnect() {
  const connecting = useWalletStore((s) => s.connecting);
  const adenaInstalled = isAdenaInstalled();

  return (
    <section className="settings-user-connect-option">
      <h3>1. Adena (browser extension)</h3>
      {adenaInstalled ? (
        <button type="button" disabled={connecting} onClick={() => void connectWallet()}>
          {connecting ? "Connecting…" : "Connect with Adena"}
        </button>
      ) : (
        <a
          className="realm-browser__gnoweb-link"
          href={ADENA_INSTALL_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Install Adena ↗
        </a>
      )}
    </section>
  );
}

function GnokeyConnect() {
  const sdk = useSdk();
  const connecting = useWalletStore((s) => s.connecting);
  const [draft, setDraft] = useState("");

  const trimmed = draft.trim();
  const valid = trimmed !== "" && isValidGnoAddress(trimmed);

  return (
    <section className="settings-user-connect-option">
      <h3>2. gnokey (CLI or mobile)</h3>
      <p className="state-line">
        No browser extension for gnokey — paste your address to browse as yourself (read-only;
        sign transactions yourself with gnokey when needed).
      </p>
      <form
        className="open-package-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !connecting) void connectManualAddress(sdk, trimmed);
        }}
      >
        <label>
          Your address
          <input
            type="text"
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="g1…"
          />
        </label>
        <button type="submit" disabled={!valid || connecting}>
          {connecting ? "Looking up…" : "Use this address"}
        </button>
      </form>
      {valid && (
        <div className="settings-user-connect-option__qr">
          <p className="state-line">
            Or scan on a device running gnokey mobile to copy the address over:
          </p>
          <QrCode value={trimmed} size={120} />
        </div>
      )}
    </section>
  );
}
