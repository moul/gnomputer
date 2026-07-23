import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { Freshness } from "../shell/freshness";

function formatBalance(coins: string): string {
  const match = /^(\d+)ugnot$/.exec(coins);
  if (!match) return coins || "0 GNOT";
  const [, amount] = match;
  const gnot = Number(amount) / 1_000_000;
  return `${gnot.toLocaleString(undefined, { maximumFractionDigits: 6 })} GNOT`;
}

export function AccountExplorer({ address }: { address: string }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  useTrailRecorder({
    uri: `gno://${networkId}/address/${address}`,
    label: address,
  });

  const {
    data: info,
    error,
    isPending,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["account", networkId, address],
    queryFn: async () => {
      const env = await sdk.rpc.getAccountInfo(address, new Date().toISOString());
      return env.data;
    },
  });

  return (
    <section className="panel" aria-label={`Account ${address}`}>
      <header className="panel__header">
        <span>Account · {address}</span>
      </header>
      <div className="panel__body">
        {!isPending && !error && <Freshness dataUpdatedAt={dataUpdatedAt} />}
        {error ? (
          <p className="state-line" role="alert">
            Could not load this account: {error.message}
          </p>
        ) : isPending ? (
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
