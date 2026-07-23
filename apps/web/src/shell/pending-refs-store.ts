import { create } from "zustand";

interface PendingRefsState {
  pendingAddress: string | null;
  pendingBlockHeight: number | null;
  setPendingAddress: (address: string | null) => void;
  setPendingBlockHeight: (height: number | null) => void;
}

export const usePendingRefsStore = create<PendingRefsState>((set) => ({
  pendingAddress: null,
  pendingBlockHeight: null,
  setPendingAddress: (address) => set({ pendingAddress: address }),
  setPendingBlockHeight: (height) => set({ pendingBlockHeight: height }),
}));
