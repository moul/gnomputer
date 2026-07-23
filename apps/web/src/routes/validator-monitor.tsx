import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { Linkified } from "../shell/linkify";
import { Freshness } from "../shell/freshness";

export function ValidatorMonitor() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  const { data, error, isPending, dataUpdatedAt } = useQuery({
    queryKey: ["validator-set", networkId],
    queryFn: async () => {
      const env = await sdk.rpc.getValidatorSet(new Date().toISOString());
      return env.data;
    },
  });

  if (error) {
    return (
      <p className="state-line" role="alert">
        Could not load the validator set: {error.message}
      </p>
    );
  }
  if (isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Loading validator set…
      </p>
    );
  }

  const totalPower = data.validators.reduce((sum, v) => sum + Number(v.votingPower), 0);
  const sorted = [...data.validators].sort((a, b) => Number(b.votingPower) - Number(a.votingPower));

  return (
    <div className="validator-monitor">
      <Freshness dataUpdatedAt={dataUpdatedAt} />
      <p className="state-line">
        {data.validators.length} validators · {totalPower} total voting power · at height #
        {data.height}
      </p>
      <ul className="validator-list">
        {sorted.map((v) => (
          <li key={v.address} className="validator-list__row">
            <span className="validator-list__address">
              <Linkified text={v.address} />
            </span>
            <span className="validator-list__power">power {v.votingPower}</span>
            <span className="validator-list__priority">priority {v.proposerPriority}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
