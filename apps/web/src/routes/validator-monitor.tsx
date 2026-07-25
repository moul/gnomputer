import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { Linkified } from "../shell/linkify";
import { Freshness } from "../shell/freshness";
import { ErrorState } from "../shell/error-state";
import { openGnockpitEmbed } from "../shell/open-gnockpit-embed";
import { formatNumber } from "../format-number";
import type { ValidatorInfo } from "@gnomputer/app-sdk";

type SortKey = "address" | "votingPower" | "proposerPriority";
type SortDir = "asc" | "desc";

function compareValidators(a: ValidatorInfo, b: ValidatorInfo, key: SortKey): number {
  if (key === "address") return a.address.localeCompare(b.address);
  return Number(a[key]) - Number(b[key]);
}

export function ValidatorMonitor() {
  const sdk = useSdk();
  const network = sdk.networks.getActive();
  const networkId = network.id;
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("votingPower");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, error, isPending, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["validator-set", networkId],
    queryFn: async () => {
      const env = await sdk.rpc.getValidatorSet(new Date().toISOString());
      return env.data;
    },
  });

  if (error) {
    return (
      <ErrorState
        message={`Could not load the validator set: ${error.message}`}
        onRetry={() => void refetch()}
      />
    );
  }
  if (isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Loading validator set…
      </p>
    );
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "address" ? "asc" : "desc");
    }
  }

  const totalPower = data.validators.reduce((sum, v) => sum + Number(v.votingPower), 0);
  const filtered = filter.trim()
    ? data.validators.filter((v) => v.address.toLowerCase().includes(filter.trim().toLowerCase()))
    : data.validators;
  const sorted = [...filtered].sort((a, b) => {
    const cmp = compareValidators(a, b, sortKey);
    return sortDir === "asc" ? cmp : -cmp;
  });

  function sortIndicator(key: SortKey): string {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="validator-monitor">
      <Freshness dataUpdatedAt={dataUpdatedAt} />
      <p className="state-line">
        {data.validators.length} validators · {formatNumber(totalPower)} total voting power · at height #
        {formatNumber(data.height)}
      </p>
      <div className="validator-monitor__toolbar">
        <input
          type="text"
          autoComplete="off"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by address…"
        />
        {network.gnockpitUrl && (
          <span className="validator-monitor__links">
            <button type="button" onClick={() => openGnockpitEmbed(network.gnockpitUrl as string)}>
              Open Gnockpit
            </button>
          </span>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="state-line">No validators match &ldquo;{filter}&rdquo;.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => toggleSort("address")}>
                  Address{sortIndicator("address")}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("votingPower")}>
                  Voting power{sortIndicator("votingPower")}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("proposerPriority")}>
                  Proposer priority{sortIndicator("proposerPriority")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr key={v.address}>
                <td>
                  <Linkified text={v.address} />
                </td>
                <td>{formatNumber(Number(v.votingPower))}</td>
                <td>{formatNumber(Number(v.proposerPriority))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
