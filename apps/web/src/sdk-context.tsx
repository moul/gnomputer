import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createGnomputerSDK, type GnomputerSDK } from "@gnomputer/app-sdk";

const SdkContext = createContext<GnomputerSDK | null>(null);

export function SdkProvider({
  children,
  overrideSdk,
}: {
  children: ReactNode;
  overrideSdk?: GnomputerSDK;
}) {
  const createdSdk = useMemo(() => createGnomputerSDK(), []);
  const sdk = overrideSdk ?? createdSdk;
  return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
}

export function useSdk(): GnomputerSDK {
  const sdk = useContext(SdkContext);
  if (!sdk) throw new Error("useSdk() called outside <SdkProvider>");
  return sdk;
}
