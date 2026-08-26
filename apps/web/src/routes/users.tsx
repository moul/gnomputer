import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { Combobox } from "../shell/combobox";
import { useShellStore } from "../store";
import { openRef } from "../shell/open-ref";
import { useResolveUser } from "../use-resolve-user";
import { ErrorState } from "../shell/error-state";
import { useWalletStore } from "../shell/wallet-store";
import {
  registerUsernameIntent,
  isValidUsername,
  USERNAME_FORMAT_HINT,
  USERS_REGISTRY_PACKAGE,
} from "../shell/register-username";
import { gnowebTxLink } from "../shell/gnoweb-links";
import { QrCode } from "../shell/qr-code";
import { useAddressSuggestions } from "../shell/use-address-suggestions";
import { submitIntent, type IntentPhase } from "../shell/transaction-intent";
import { TransactionReview } from "../shell/transaction-review";

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
// Polls the registry until the username actually resolves, so "confirmed"
// means the chain agrees — not merely that the wallet accepted the tx.
// Bounded, because a tx can legitimately never land.
const CONFIRM_TIMEOUT_MS = 45_000;
const CONFIRM_POLL_MS = 3000;

async function waitForUsername(refetch: () => Promise<{ data?: unknown }>): Promise<boolean> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, CONFIRM_POLL_MS));
    const { data } = await refetch();
    const found = (data as { found?: boolean } | undefined)?.found;
    if (found) return true;
  }
  return false;
}

function RegisterUsernameSection({ address }: { address: string }) {
  const sdk = useSdk();
  const account = useWalletStore((s) => s.account);
  const { data: result, isPending, refetch } = useResolveUser(address);
  const networkChainId = useSdk().networks.getActive().chainId;
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Signature requests go through a review step; `tx` drives it.
  const [tx, setTx] = useState<IntentPhase>({ phase: "idle" });

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
          setError(null);
          try {
            // Opens the review — nothing is sent to the wallet until the
            // user approves it there.
            setTx({ phase: "review", intent: registerUsernameIntent(trimmed) });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Registration failed.");
          }
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
      <TransactionReview
        state={tx}
        account={account}
        networkChainId={networkChainId}
        // No explorer tx-URL convention verified for this network yet, so
        // the hash is shown without a link rather than linking somewhere
        // that may 404.
        onCancel={() => setTx({ phase: "idle" })}
        onDismiss={() => setTx({ phase: "idle" })}
        onConfirm={() => {
          if (tx.phase !== "review") return;
          const intent = tx.intent;
          setSubmitting(true);
          setTx({ phase: "signing", intent });
          submitIntent(intent, account, networkChainId)
            .then(async ({ hash }) => {
              // The wallet returning success means accepted+broadcast, not
              // confirmed — so this waits for the chain rather than
              // declaring victory here.
              setTx({ phase: "submitted", intent, hash });
              const confirmed = await waitForUsername(refetch);
              setTx(
                confirmed
                  ? { phase: "confirmed", intent, hash }
                  : {
                      phase: "failed",
                      intent,
                      error:
                        "Submitted, but it hasn't shown up on chain yet. It may still land — check your wallet or an explorer.",
                    }
              );
              if (confirmed) setDraft("");
            })
            .catch((err: unknown) =>
              setTx({
                phase: "failed",
                intent,
                error: err instanceof Error ? err.message : "Registration failed.",
              })
            )
            .finally(() => setSubmitting(false));
        }}
      />
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
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const recentAddresses = useRecentlyLookedUpAddresses();
  const addressSuggestions = useAddressSuggestions(focused, draft);

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

  // Read straight off the realm rather than the indexer: `Controllers()` is an
  // exported function, so this works on any network with an RPC — including
  // ones with no indexer, where the rest of this app has nothing to show.
  // It answers the question the stats line raises but does not: registration
  // is whitelisted, so *who* is allowed to register a name here.
  const { data: controllers } = useQuery({
    queryKey: ["users-controllers", sdk.networks.getActive().id],
    queryFn: async () => {
      const env = await sdk.rpc.evalExpression(
        USERS_PACKAGE,
        "Controllers()",
        new Date().toISOString()
      );
      // qeval renders Gno values, not JSON: a []address comes back as
      // `(slice[("g1…" .uverse.address)] [].uverse.address)`.
      return [...env.data.matchAll(/"(g1[a-z0-9]+)"/g)].map((m) => m[1]!);
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
          message="Could not load directory stats" error={statsError}
          onRetry={() => void refetchStats()}
        />
      ) : (
        <p className="state-line" aria-busy={statsPending}>
          {statsPending
            ? "Loading directory stats…"
            : `${stats?.addresses ?? "?"} addresses · ${stats?.names ?? "?"} names registered on ${USERS_PACKAGE}.`}
        </p>
      )}
      {controllers && controllers.length > 0 && (
        <div className="users-app__controllers">
          <p className="settings-section-label">
            Whitelisted to register names ({controllers.length})
          </p>
          <ul className="users-app__recent-list">
            {controllers.map((address) => (
              <li key={address}>
                <button
                  type="button"
                  className="users-app__address-link"
                  onClick={(e) =>
                    openRef(`gno://_/address/${address}`, { x: e.clientX, y: e.clientY })
                  }
                >
                  {address}
                </button>
              </li>
            ))}
          </ul>
        </div>
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
          <Combobox
            listLabel="Address suggestions"
            value={draft}
            onChange={setDraft}
            // Taking a suggestion is the search — the form's submit does the
            // same thing with whatever was typed.
            onSelect={(option) => setQuery(option.value)}
            // Not elided: an address is the content here rather than a label
            // for something else, and the list is as wide as the window.
            options={addressSuggestions.map((address) => ({ value: address }))}
            inputProps={{
              "data-1p-ignore": "true",
              "data-lpignore": "true",
              "data-bwignore": "true",
              onFocus: () => setFocused(true),
              onBlur: () => setFocused(false),
              placeholder: "@moul, moul, or g1…",
            }}
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
            Search by username or address. A full listing would need an indexer that can enumerate
            the realm&rsquo;s name store; the realm itself only exposes lookups and totals.
          </p>
        )
      ) : lookupPending ? (
        <p className="state-line" aria-busy="true">
          Looking up &ldquo;{query}&rdquo;…
        </p>
      ) : lookupError ? (
        <ErrorState
          message={`Could not look up "${query}"`} error={lookupError}
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
