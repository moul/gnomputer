import { create } from "zustand";

interface EmbedWindowState {
  url: string | null;
  title: string | null;
  setEmbed: (url: string, title: string) => void;
}

export const useEmbedWindowStore = create<EmbedWindowState>((set) => ({
  url: null,
  title: null,
  setEmbed: (url, title) => set({ url, title }),
}));
