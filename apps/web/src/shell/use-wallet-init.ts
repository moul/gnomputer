import { useEffect } from "react";
import { initWalletListeners } from "./wallet-connect";

/** Mounted once at the app root — see initWalletListeners for what it does. */
export function useWalletInit(): void {
  useEffect(() => initWalletListeners(), []);
}
