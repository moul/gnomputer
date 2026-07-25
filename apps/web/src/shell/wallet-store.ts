import { create } from "zustand";

export interface WalletAccount {
  address: string;
  chainId: string;
  coins: string;
  /** "adena" can sign real transactions (window.adena.DoContract); "manual"
   * is a self-entered address for gnokey CLI/mobile users — Gnomputer can
   * show their real on-chain data but has no way to sign on their behalf,
   * so anything that needs a signature falls back to a TxLink + QR they
   * complete themselves via gnokey. */
  source: "adena" | "manual";
}

interface WalletState {
  account: WalletAccount | null;
  connecting: boolean;
  error: string | null;
  setAccount: (account: WalletAccount | null) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  account: null,
  connecting: false,
  error: null,
  setAccount: (account) => set({ account, error: null }),
  setConnecting: (connecting) => set({ connecting }),
  setError: (error) => set({ error, connecting: false }),
}));
