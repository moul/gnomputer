import { create } from "zustand";

export interface WalletAccount {
  address: string;
  chainId: string;
  coins: string;
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
