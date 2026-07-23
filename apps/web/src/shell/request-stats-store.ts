import { create } from "zustand";

interface RequestStatsState {
  requestCount: number;
  bootedAt: number;
  increment: () => void;
}

export const useRequestStatsStore = create<RequestStatsState>((set) => ({
  requestCount: 0,
  bootedAt: Date.now(),
  increment: () => set((s) => ({ requestCount: s.requestCount + 1 })),
}));
