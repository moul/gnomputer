import type { AdenaContractMessage } from "./adena";
import type { WalletAccount } from "./wallet-store";

/** A signature request, described in terms a human can review, before it
 * ever reaches the wallet.
 *
 * The product spec's rule is "never let apps call wallets directly"
 * (docs/product/gnomputer-spec.md) — this type plus `submitIntent` is the
 * one place that rule is enforced. Previously `register-username.ts` built
 * an Adena `DoContract` payload and submitted it inline, with no review
 * step, no chain-match check, and no lifecycle beyond "the wallet returned
 * success" (AUD-001/002/003, #92). */
export interface TransactionIntent {
  /** Short human-readable summary, e.g. "Register the username abc123". */
  summary: string;
  /** Realm/package the call lands on, shown in the review. */
  packagePath: string;
  /** Exported function being invoked. */
  func: string;
  /** Positional arguments, exactly as they'll be sent. */
  args: string[];
  /** Funds attached, in the chain's own `1000000ugnot` string form.
   * Undefined means none — shown explicitly either way, because "how much
   * am I sending" is the single most important thing to review. */
  send?: string;
  /** Why this costs what it costs, in plain language (e.g. the registry's
   * fixed registration price). Shown next to the amount. */
  sendReason?: string;
}

export type IntentPhase =
  | { phase: "idle" }
  | { phase: "review"; intent: TransactionIntent }
  | { phase: "signing"; intent: TransactionIntent }
  | { phase: "submitted"; intent: TransactionIntent; hash?: string }
  | { phase: "confirmed"; intent: TransactionIntent; hash?: string }
  | { phase: "failed"; intent: TransactionIntent; error: string };

export class ChainMismatchError extends Error {
  constructor(
    readonly walletChainId: string,
    readonly networkChainId: string
  ) {
    super(
      `Your wallet is on "${walletChainId}" but Gnomputer is pointed at "${networkChainId}". ` +
        `Switch the wallet's network (or Gnomputer's) so they match, then try again.`
    );
    this.name = "ChainMismatchError";
  }
}

/** Refuses to sign unless the wallet and the active network are the same
 * chain. Without this a user connected to one chain could be prompted to
 * sign against another — the wallet's own prompt shows a chain id, but
 * nothing in Gnomputer ever compared them (AUD-002).
 *
 * A custom network with `chainId: "unknown"` (custom-networks-store.ts
 * can't discover it) is never signable: "unknown" can't be shown to equal
 * anything. */
export function assertChainMatch(account: WalletAccount, networkChainId: string): void {
  if (!networkChainId || networkChainId === "unknown") {
    throw new Error(
      "This network's chain ID is unknown, so Gnomputer can't confirm your wallet is on the same " +
        "chain. Signing is disabled here."
    );
  }
  if (account.chainId !== networkChainId) {
    throw new ChainMismatchError(account.chainId, networkChainId);
  }
}

export function intentToMessage(intent: TransactionIntent, account: WalletAccount): AdenaContractMessage {
  return {
    type: "/vm.m_call",
    value: {
      caller: account.address,
      send: intent.send ?? "",
      pkg_path: intent.packagePath,
      func: intent.func,
      args: intent.args,
    },
  };
}

/** Adena's response carries the tx hash in different shapes across
 * versions, and the type is `unknown` — pull it out defensively so a
 * missing hash degrades to "no explorer link" rather than throwing. */
export function extractTxHash(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const record = data as Record<string, unknown>;
  for (const key of ["hash", "txHash", "tx_hash"]) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

/** The ONLY place in the app that asks a wallet to sign. Everything else
 * builds a TransactionIntent and routes it here, so the chain-match guard
 * and the review step can't be bypassed by a new feature forgetting them. */
export async function submitIntent(
  intent: TransactionIntent,
  account: WalletAccount,
  networkChainId: string
): Promise<{ hash?: string }> {
  if (account.source !== "adena") {
    throw new Error(
      "This account was entered manually, so Gnomputer can't sign for it. Use the gnokey link instead."
    );
  }
  if (!window.adena) throw new Error("Adena is not available.");
  assertChainMatch(account, networkChainId);

  const res = await window.adena.DoContract({ messages: [intentToMessage(intent, account)] });
  if (res.status !== "success") {
    throw new Error(res.message || "The wallet rejected or failed to submit this transaction.");
  }
  // NOTE: "success" here means the wallet accepted and broadcast it, NOT
  // that it's confirmed on chain. Callers must treat this as `submitted`
  // and wait for confirmation separately.
  return { hash: extractTxHash(res.data) };
}
