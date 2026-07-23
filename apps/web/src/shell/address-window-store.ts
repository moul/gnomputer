import { create } from "zustand";

interface AddressWindowState {
  currentAddress: string | null;
  setCurrentAddress: (address: string) => void;
}

export const useAddressWindowStore = create<AddressWindowState>((set) => ({
  currentAddress: null,
  setCurrentAddress: (address) => set({ currentAddress: address }),
}));
