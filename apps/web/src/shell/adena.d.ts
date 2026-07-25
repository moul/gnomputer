// Ambient types for the Adena wallet's injected window.adena provider
// (docs.adena.app/integrations) — no official @types package exists, and
// this only covers the subset Gnomputer actually calls.
export interface AdenaAccountData {
  status: "ACTIVE" | "IN_ACTIVE";
  address: string;
  coins: string;
  public_key: { "@type": string; value: string };
  account_number: string;
  sequence: string;
  chainId: string;
}

export interface AdenaResponse<T> {
  code: number;
  status: "success" | "failure";
  type: string;
  message: string;
  data: T;
}

export interface AdenaContractMessage {
  type: "/bank.MsgSend" | "/vm.m_call" | "/vm.m_addpkg" | "/vm.m_run";
  value: Record<string, unknown>;
}

export interface AdenaProvider {
  AddEstablish(name: string): Promise<AdenaResponse<unknown>>;
  GetAccount(): Promise<AdenaResponse<AdenaAccountData>>;
  On(event: "changedAccount" | "changedNetwork", callback: (value: string) => void): void;
  Off?(event: "changedAccount" | "changedNetwork", callback: (value: string) => void): void;
  DoContract(params: {
    messages: AdenaContractMessage[];
    gasFee?: number;
    gasWanted?: number;
  }): Promise<AdenaResponse<unknown>>;
}

declare global {
  interface Window {
    adena?: AdenaProvider;
  }
}
