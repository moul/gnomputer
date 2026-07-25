import { useWalletStore } from "./wallet-store";
import { connectWallet, disconnectWallet, isAdenaInstalled } from "./wallet-connect";

function formatUgnot(coins: string): string {
  const match = /^(\d+)ugnot$/.exec(coins.trim());
  if (!match) return coins;
  return `${(Number(match[1]) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} GNOT`;
}

export function SettingsUserTab() {
  const account = useWalletStore((s) => s.account);
  const connecting = useWalletStore((s) => s.connecting);
  const error = useWalletStore((s) => s.error);
  const adenaInstalled = isAdenaInstalled();

  if (account) {
    return (
      <div className="settings-tab">
        <div className="settings-user-identity">
          <span className="settings-user-identity__emoji" aria-hidden="true">
            🟢
          </span>
          <div>
            <p className="settings-user-identity__label">Connected via Adena</p>
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
        <button
          type="button"
          disabled={connecting}
          onClick={() => void connectWallet()}
          title={adenaInstalled ? undefined : "Opens adena.app to install the extension"}
        >
          {connecting ? "Connecting…" : adenaInstalled ? "Connect" : "Install Adena"}
        </button>
      </div>
      {error && <p className="settings-user-identity__error">{error}</p>}
    </div>
  );
}
