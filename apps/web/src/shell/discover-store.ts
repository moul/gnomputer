import { create } from "zustand";

export type DiscoverTab = "users" | "packages" | "transactions" | "tokens" | "governance";

interface DiscoverState {
  tab: DiscoverTab;
  setTab: (tab: DiscoverTab) => void;
}

export const useDiscoverStore = create<DiscoverState>((set) => ({
  tab: "users",
  setTab: (tab) => set({ tab }),
}));
