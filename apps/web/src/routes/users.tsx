import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { openRef } from "../shell/open-ref";
import { useResolveUser } from "../use-resolve-user";
import { ErrorState } from "../shell/error-state";
import { useWalletStore } from "../shell/wallet-store";
import {
  registerUsername,
  isValidUsername,
  USERNAME_FORMAT_HINT,
  USERS_REGISTRY_PACKAGE,
} from "../shell/register-username";
import { gnowebTxLink } from "../shell/gnoweb-links";
import { QrCode } from "../shell/qr-code";

const USERS_PACKAGE = "gno.land/r/sys/users";
// How many recently-looked-up addresses show — mirrors island-clock.tsx's
// own RECENT_STEPS_LIMIT for the same kind of "recent" list.
const RECENT_LOOKUPS_LIMIT = 8;

/** Extracts the address from a Trail step's gno://<network>/address/<addr>
 * ref URI, or null for any other kind of step. */
export function addressFromRefUri(refUri: string): string | null {
  const match = /^gno:\/\/[^/]+\/address\/(.+)$/.exec(refUri);
  return match?.[1] ?? null;
}

/** Recently-looked-up addresses, most recent first — sourced from the
 * user's own Trail (there's no chain-side way to list "recently active
 * users" the way Browser's Recently Active does for realms: chain events
 * carry no signer/caller address, only pkgPath — see rank-by-activity.ts).
 * A personal "recently looked up" list is the honest equivalent available
 * here. */
function useRecentlyLookedUpAddresses(): string[] {
  const sdk = useSdk();
  const trailVersion = useShellStore((s) => s.trailVersion);
  const [addresses, setAddresses] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const trailId = await sdk.trails.getActiveTrailId();
      if (cancelled || !trailId) return;
      const steps = await sdk.trails.getSteps(trailId);
      if (cancelled) return;
      const seen = new Set<string>();
      const recent: string[] = [];
      for (let i = steps.length - 1; i >= 0 && recent.length < RECENT_LOOKUPS_LIMIT; i--) {
        const address = addressFromRefUri(steps[i]!.refUri);
        if (address && !seen.has(address)) {
          seen.add(address);
          recent.push(address);
        }
      }
      setAddresses(recent);
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, trailVersion]);

  return addresses;
}

/** Shown only once connected (useWalletStore) — checks whether the
 * connected address already has a username via the same ResolveAny lookup
 * the search form uses, and offers to register one if not, via the real
 * Register() call on gno.land/r/gnoland/users/v1 (see register-username.ts). */
function RegisterUsernameSection({ address }: { address: string }) {
  const sdk = useSdk();
  const account = useWalletStore((s) => s.account);
  const { data: result, isPending, refetch } = useResolveUser(address);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPending || !account) return null;
  if (result?.found && result.username) {
    return (
      <p className="state-line">
        Registered as <strong>{result.username}</strong>.
      </p>
    );
  }

  // No Adena (gnokey CLI/mobile connect) means no way to sign a DoContract
  // call from here — same TxLink + QR fallback Realm Actions uses, pointing
  // straight at the Register function's real gnoweb form.
  if (account.source === "manual") {
    const gnowebUrl = sdk.networks.getActive().gnowebUrl;
    if (!gnowebUrl) {
      return (
        <p className="state-line">
          No registered username yet, and no gnoweb URL configured on this network to register one
          via gnokey.
        </p>
      );
    }
    const txLink = gnowebTxLink(gnowebUrl, USERS_REGISTRY_PACKAGE, "Register");
    return (
      <div className="users-app__register">
        <p className="state-line">
          No registered username yet. Gnomputer can&rsquo;t sign for a gnokey-connected address —
          open the real Register form and complete it with gnokey (CLI or mobile):
        </p>
        <p className="realm-actions__links">
          <a className="realm-browser__gnoweb-link" href={txLink} target="_blank" rel="noopener noreferrer">
            Register on gnoweb ↗
          </a>
        </p>
        <QrCode value={txLink} size={140} />
      </div>
    );
  }

  const trimmed = draft.trim();
  const valid = trimmed !== "" && isValidUsername(trimmed);

  return (
    <div className="users-app__register">
      <p className="state-line">Your connected account has no registered username yet.</p>
      <form
        className="open-package-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || submitting) return;
          setSubmitting(true);
          setError(null);
          registerUsername(account, trimmed)
            .then(() => {
              setDraft("");
              void refetch();
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Registration failed."))
            .finally(() => setSubmitting(false));
        }}
      >
        <label>
          Register a username (1 GNOT)
          <input
            type="text"
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="abc123"
          />
        </label>
        <button type="submit" disabled={!valid || submitting}>
          {submitting ? "Registering…" : "Register"}
        </button>
      </form>
      {draft && !valid && <p className="state-line">{USERNAME_FORMAT_HINT}</p>}
      {error && <p className="settings-user-identity__error">{error}</p>}
    </div>
  );
}

// gno.land/r/sys/users has no function that enumerates registered users —
// only per-user lookups (ResolveAny/ResolveAddress/ResolveName) and the two
// aggregate counts its own Render() shows. The indexer's GraphQL endpoint
// now allows browser access, but it has no field that enumerates users
// either, and filtering getTransactions for calls to the registry realm
// (gno.land/r/gnoland/users/v1) came back empty even though 22 real
// usernames are registered (confirmed live) — this indexer instance
// apparently doesn't have those registrations in its indexed range, so a
// real directory listing still isn't reliably available. This app stays a
// lookup tool plus those same two counts, not a browsable list.
export function Users() {
  const sdk = useSdk();
  const account = useWalletStore((s) => s.account);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const recentAddresses = useRecentlyLookedUpAddresses();

  const {
    data: stats,
    error: statsError,
    isPending: statsPending,
    refetch: refetchStats,
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
    refetch: refetchLookup,
  } = useResolveUser(query);

  return (
    <div className="users-app">
      {statsError ? (
        <ErrorState
          message={`Could not load directory stats: ${statsError.message}`}
          onRetry={() => void refetchStats()}
        />
      ) : (
        <p className="state-line" aria-busy={statsPending}>
          {statsPending
            ? "Loading directory stats…"
            : `${stats?.addresses ?? "?"} addresses · ${stats?.names ?? "?"} names registered on ${USERS_PACKAGE}.`}
        </p>
      )}
      {account && <RegisterUsernameSection address={account.address} />}
      <form
        className="open-package-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setQuery(draft.trim());
        }}
      >
        <label>
          Look up a user
          <input
            type="text"
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="@moul, moul, or g1…"
          />
        </label>
        <button type="submit" disabled={!draft.trim()}>
          Search
        </button>
      </form>

      {query === null ? (
        recentAddresses.length > 0 ? (
          <div className="users-app__recent">
            <p className="users-app__recent-title">Recently looked up</p>
            <ul className="users-app__recent-list">
              {recentAddresses.map((address) => (
                <li key={address}>
                  <button
                    type="button"
                    className="users-app__address-link"
                    onClick={(e) => openRef(`gno://_/address/${address}`, { x: e.clientX, y: e.clientY })}
                  >
                    {address}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="state-line">
            Search by username or address — there&rsquo;s no way to browse every registered user
            without the indexer.
          </p>
        )
      ) : lookupPending ? (
        <p className="state-line" aria-busy="true">
          Looking up &ldquo;{query}&rdquo;…
        </p>
      ) : lookupError ? (
        <ErrorState
          message={`Could not look up "${query}": ${lookupError.message}`}
          onRetry={() => void refetchLookup()}
        />
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
                onClick={(e) => openRef(`gno://_/address/${result.address}`, { x: e.clientX, y: e.clientY })}
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
