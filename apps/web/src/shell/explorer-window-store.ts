import { create } from "zustand";

interface ExplorerWindowState {
  url: string | null;
  setUrl: (url: string) => void;
}

export const useExplorerWindowStore = create<ExplorerWindowState>((set) => ({
  url: null,
  setUrl: (url) => set({ url }),
}));
