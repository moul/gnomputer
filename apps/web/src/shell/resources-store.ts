import { create } from "zustand";

export type ResourcesTab = "docs" | "awesome-gno" | "about";

interface ResourcesState {
  tab: ResourcesTab;
  selectedDoc: string | null;
  setTab: (tab: ResourcesTab) => void;
  setSelectedDoc: (path: string | null) => void;
}

export const useResourcesStore = create<ResourcesState>((set) => ({
  tab: "docs",
  selectedDoc: null,
  setTab: (tab) => set({ tab }),
  setSelectedDoc: (selectedDoc) => set({ selectedDoc }),
}));
