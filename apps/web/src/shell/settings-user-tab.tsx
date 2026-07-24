export function SettingsUserTab() {
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
    </div>
  );
}
