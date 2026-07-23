import { create } from "zustand";

export type RealmLens = "render" | "source";

interface RealmLensState {
  lens: RealmLens;
  setLens: (lens: RealmLens) => void;
}

export const useRealmLensStore = create<RealmLensState>((set) => ({
  lens: "render",
  setLens: (lens) => set({ lens }),
}));
