import { create } from "zustand";

interface PendingRefsState {
  pendingBlockHeight: number | null;
  setPendingBlockHeight: (height: number | null) => void;
}

export const usePendingRefsStore = create<PendingRefsState>((set) => ({
  pendingBlockHeight: null,
  setPendingBlockHeight: (height) => set({ pendingBlockHeight: height }),
}));
