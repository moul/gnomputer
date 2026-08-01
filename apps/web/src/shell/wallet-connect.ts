import type { GnomputerSDK } from "@gnomputer/app-sdk";
import { useWalletStore } from "./wallet-store";
import { isValidGnoAddress } from "@gnomputer/entities";

export const ADENA_INSTALL_URL = "https://www.adena.app/";

export function isAdenaInstalled(): boolean {
  return typeof window !== "undefined" && !!window.adena;
}

// Re-exported so the many callers that import it from here keep working;
// the implementation is a real bech32 decode in @gnomputer/entities. It was
// a shape-only regex, which accepts a checksum-invalid address (AUD-031).
export { isValidGnoAddress };

async function refreshAccount(): Promise<boolean> {
  if (!window.adena) return false;
  const res = await window.adena.GetAccount();
  if (res.status !== "success") return false;
  useWalletStore.getState().setAccount({
    address: res.data.address,
    chainId: res.data.chainId,
    coins: res.data.coins,
    source: "adena",
  });
  return true;
}

/** The "Connect" button's action — installs-then-bails if Adena isn't
 * present, otherwise requests the per-origin connection (AddEstablish,
 * which is a no-op if this origin is already on Adena's whitelist) and
 * reads the resulting account. */
export async function connectWallet(): Promise<void> {
  if (!window.adena) {
    window.open(ADENA_INSTALL_URL, "_blank", "noopener,noreferrer");
    return;
  }
  const store = useWalletStore.getState();
  store.setConnecting(true);
  try {
    await window.adena.AddEstablish("Gnomputer");
    const ok = await refreshAccount();
    if (!ok) store.setError("Adena did not return an account.");
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Could not connect to Adena.");
  } finally {
    useWalletStore.getState().setConnecting(false);
  }
}

/** The gnokey CLI/mobile alternative: no browser extension can speak for
 * these, so instead of a signing handshake the user pastes their own
 * address and Gnomputer looks up its real on-chain balance — a read-only
 * identity. Anything that needs a signature (e.g. registering a username)
 * falls back to a real gnoweb TxLink + QR the user completes with gnokey
 * directly, the same pattern Realm Actions already uses. */
export async function connectManualAddress(sdk: GnomputerSDK, address: string): Promise<void> {
  const trimmed = address.trim();
  const store = useWalletStore.getState();
  if (!isValidGnoAddress(trimmed)) {
    store.setError("That doesn't look like a Gno address (expected g1…).");
    return;
  }
  store.setConnecting(true);
  try {
    const env = await sdk.rpc.getAccountInfo(trimmed, new Date().toISOString());
    store.setAccount({
      address: trimmed,
      chainId: sdk.networks.getActive().chainId,
      coins: env.data.balance,
      source: "manual",
    });
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Could not look up that address.");
  } finally {
    useWalletStore.getState().setConnecting(false);
  }
}

/** Guest-mode local state only — Adena's own per-origin whitelist (Settings
 * → Connected Apps in the extension) isn't something this app can revoke
 * from the outside, so "disconnect" here just stops using the account,
 * same as closing a tab would. */
export function disconnectWallet(): void {
  useWalletStore.getState().setAccount(null);
}

/** Called once at app startup: silently checks whether this origin is
 * already on Adena's whitelist from a previous session (GetAccount just
 * fails harmlessly if not — no AddEstablish prompt), and subscribes to
 * account-switch events so the connected identity stays in sync with
 * whatever account is active in the extension. Returns an unsubscribe. */
export function initWalletListeners(): () => void {
  if (!window.adena) return () => {};
  void refreshAccount().catch(() => {
    // Not yet connected from this origin — stays Guest, no error shown for
    // what's actually the common case (first visit).
  });
  const handler = () => {
    void refreshAccount().catch(() => useWalletStore.getState().setAccount(null));
  };
  window.adena.On("changedAccount", handler);
  return () => window.adena?.Off?.("changedAccount", handler);
}
