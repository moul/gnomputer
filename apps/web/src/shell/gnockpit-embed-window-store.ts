import { create } from "zustand";

interface GnockpitEmbedWindowState {
  url: string | null;
  setUrl: (url: string) => void;
}

export const useGnockpitEmbedWindowStore = create<GnockpitEmbedWindowState>((set) => ({
  url: null,
  setUrl: (url) => set({ url }),
}));
