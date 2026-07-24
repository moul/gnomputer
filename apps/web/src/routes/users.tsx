import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { openRef } from "../shell/open-ref";

const USERS_PACKAGE = "gno.land/r/sys/users";

// gno.land/r/sys/users has no function that enumerates registered users —
// only per-user lookups (ResolveAny/ResolveAddress/ResolveName) and the two
// aggregate counts its own Render() shows. A real directory listing would
// need the indexer (unreachable from the browser, ADR-012/015), so this app
// is a lookup tool plus those same two counts, not a browsable list.
export function Users() {
  const sdk = useSdk();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState<string | null>(null);

  const {
    data: stats,
    error: statsError,
    isPending: statsPending,
  } = useQuery({
    queryKey: ["users-stats", sdk.networks.getActive().id],
    queryFn: async () => {
      const env = await sdk.rpc.queryRender(USERS_PACKAGE, "", new Date().toISOString());
      const addresses = /registered:\s*\*\*(\d+)\*\*/.exec(env.data);
      const names = /names registered:\s*\*\*(\d+)\*\*/.exec(env.data);
      return {
        addresses: addresses ? Number(addresses[1]) : null,
        names: names ? Number(names[1]) : null,
      };
    },
  });

  const {
    data: result,
    error: lookupError,
    isPending: lookupPending,
  } = useQuery({
    queryKey: ["users-lookup", sdk.networks.getActive().id, query],
    queryFn: async () => {
      const env = await sdk.rpc.evalExpression(USERS_PACKAGE, `ResolveAny("${query}")`, new Date().toISOString());
      return sdk.lenses.parseUserData(env.data);
    },
    enabled: query !== null && query !== "",
  });

  return (
    <div className="users-app">
      <p className="state-line">
        {statsPending
          ? "Loading directory stats…"
          : statsError
            ? `Could not load directory stats: ${statsError.message}`
            : `${stats?.addresses ?? "?"} addresses · ${stats?.names ?? "?"} names registered on ${USERS_PACKAGE}.`}
      </p>
      <form
        className="open-package-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setQuery(draft.trim());
        }}
      >
        <label>
          Look up a user
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="test1 or g1…" />
        </label>
        <button type="submit" disabled={!draft.trim()}>
          Search
        </button>
      </form>

      {query === null ? (
        <p className="state-line">
          Search by username or address — there&rsquo;s no way to browse every registered user
          without the indexer.
        </p>
      ) : lookupPending ? (
        <p className="state-line" aria-busy="true">
          Looking up &ldquo;{query}&rdquo;…
        </p>
      ) : lookupError ? (
        <p className="state-line" role="alert">
          Could not look up &ldquo;{query}&rdquo;: {lookupError.message}
        </p>
      ) : !result?.found ? (
        <p className="state-line">No registered user matches &ldquo;{query}&rdquo;.</p>
      ) : (
        <dl className="account-fields">
          <dt>Username</dt>
          <dd>{result.username || "(none)"}</dd>
          <dt>Address</dt>
          <dd>
            {result.address ? (
              <button
                type="button"
                className="users-app__address-link"
                onClick={() => openRef(`gno://_/address/${result.address}`)}
              >
                {result.address}
              </button>
            ) : (
              "(unknown)"
            )}
          </dd>
        </dl>
      )}
    </div>
  );
}
