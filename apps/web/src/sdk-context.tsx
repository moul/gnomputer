import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createGnomputerSDK, type GnomputerSDK } from "@gnomputer/app-sdk";
import { testNetworkOverride } from "./test-network-override";

const SdkContext = createContext<GnomputerSDK | null>(null);

export function SdkProvider({
  children,
  overrideSdk,
}: {
  children: ReactNode;
  overrideSdk?: GnomputerSDK;
}) {
  const createdSdk = useMemo(() => {
    const sdk = createGnomputerSDK();
    // Point the whole app at a local mock RPC when VITE_RPC_URL is set
    // (e2e only — no-op in any normal build). See test-network-override.ts.
    const override = testNetworkOverride();
    if (override) sdk.networks.setActiveConfig(override);
    return sdk;
  }, []);
  const sdk = overrideSdk ?? createdSdk;
  return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
}

export function useSdk(): GnomputerSDK {
  const sdk = useContext(SdkContext);
  if (!sdk) throw new Error("useSdk() called outside <SdkProvider>");
  return sdk;
}
