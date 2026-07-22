import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import type { AccountInfo } from "@gnomputer/app-sdk";

function formatBalance(coins: string): string {
  const match = /^(\d+)ugnot$/.exec(coins);
  if (!match) return coins || "0 GNOT";
  const [, amount] = match;
  const gnot = Number(amount) / 1_000_000;
  return `${gnot.toLocaleString(undefined, { maximumFractionDigits: 6 })} GNOT`;
}

export function AccountExplorer({ address }: { address: string }) {
  const sdk = useSdk();
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useTrailRecorder({
    uri: `gno://${sdk.networks.getActive().id}/address/${address}`,
    label: address,
  });

  useEffect(() => {
    setInfo(null);
    setError(null);
    sdk.rpc
      .getAccountInfo(address, new Date().toISOString())
      .then((env) => setInfo(env.data))
      .catch((err: Error) => setError(err.message));
  }, [address, sdk]);

  return (
    <section className="panel" aria-label={`Account ${address}`}>
      <header className="panel__header">
        <span>Account · {address}</span>
      </header>
      <div className="panel__body">
        {error ? (
          <p className="state-line" role="alert">
            Could not load this account: {error}
          </p>
        ) : !info ? (
          <p className="state-line" aria-busy="true">
            Loading account…
          </p>
        ) : !info.initialized ? (
          <p className="state-line">
            This address has no on-chain activity yet — it has never received funds or
            sent a transaction.
          </p>
        ) : (
          <dl className="account-fields">
            <dt>Balance</dt>
            <dd>{formatBalance(info.balance)}</dd>
            <dt>Account number</dt>
            <dd>{info.accountNumber}</dd>
            <dt>Sequence</dt>
            <dd>{info.sequence}</dd>
          </dl>
        )}
      </div>
    </section>
  );
}
