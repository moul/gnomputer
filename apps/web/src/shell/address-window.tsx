import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { useResolveUser } from "../use-resolve-user";
import { Freshness } from "./freshness";
import { Window } from "./window";
import { ErrorState } from "./error-state";
import { useAddressWindowStore } from "./address-window-store";
import { useStorePersistence } from "./use-store-persistence";
import { gnowebAddressUrl, mygnoscanAddressUrl } from "./gnoweb-links";
import { openExplorer } from "./open-explorer";

function formatBalance(coins: string): string {
  const match = /^(\d+)ugnot$/.exec(coins);
  if (!match) return coins || "0 GNOT";
  const [, amount] = match;
  const gnot = Number(amount) / 1_000_000;
  return `${gnot.toLocaleString(undefined, { maximumFractionDigits: 6 })} GNOT`;
}

export function AddressWindow() {
  useStorePersistence("ui-state:address-window", useAddressWindowStore);
  const address = useAddressWindowStore((s) => s.currentAddress);
  const setCurrentAddress = useAddressWindowStore((s) => s.setCurrentAddress);

  return (
    <Window
      id="address"
      title={address ? `Accounts · ${address}` : "Accounts"}
      accent="cyan"
      startClosed
      defaultGeometry={{ x: 80, y: 80, width: 420, height: 420 }}
    >
      <div className="address-window">
        <AddressLookupForm onResolved={setCurrentAddress} />
        {address ? (
          <AddressContent address={address} />
        ) : (
          <p className="state-line">No address selected yet — look one up above.</p>
        )}
      </div>
    </Window>
  );
}

function AddressLookupForm({ onResolved }: { onResolved: (address: string) => void }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const { data: result, error, isPending, refetch } = useResolveUser(query);

  useEffect(() => {
    if (result?.found && result.address) onResolved(result.address);
  }, [result, onResolved]);

  return (
    <form
      className="open-package-form address-window__lookup"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim()) setQuery(draft.trim());
      }}
    >
      <label>
        Look up a user or address
        <input
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="@moul, moul, or g1…"
        />
      </label>
      <button type="submit" disabled={!draft.trim()}>
        Open
      </button>
      {query !== null && isPending && (
        <p className="state-line" aria-busy="true">
          Looking up &ldquo;{query}&rdquo;…
        </p>
      )}
      {error && (
        <ErrorState message={`Could not look up "${query}": ${error.message}`} onRetry={() => void refetch()} />
      )}
      {result && !result.found && (
        <p className="state-line">No registered user or address matches &ldquo;{query}&rdquo;.</p>
      )}
    </form>
  );
}

function AddressContent({ address }: { address: string }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const network = sdk.networks.getActive();
  const [copied, setCopied] = useState(false);

  useTrailRecorder({
    uri: `gno://${networkId}/address/${address}`,
    label: address,
  });

  const {
    data: username,
    error: usernameError,
    isPending: usernamePending,
  } = useQuery({
    queryKey: ["username", networkId, address],
    queryFn: async () => {
      const env = await sdk.rpc.resolveUsername(address, new Date().toISOString());
      return env.data.username;
    },
  });

  const {
    data: info,
    error: accountError,
    isPending: accountPending,
    dataUpdatedAt,
    refetch: refetchAccount,
  } = useQuery({
    queryKey: ["account", networkId, address],
    queryFn: async () => {
      const env = await sdk.rpc.getAccountInfo(address, new Date().toISOString());
      return env.data;
    },
  });

  const {
    data: packageCount,
    error: packageCountError,
    isPending: packageCountPending,
  } = useQuery({
    queryKey: ["package-count", networkId, address],
    queryFn: async () => (await sdk.indexer.countPackagesByCreator(address)).data.count,
    retry: false,
  });

  return (
    <div className="address-window">
      <div className="address-window__identity">
        <span className="address-window__emoji" aria-hidden="true">
          👤
        </span>
        <div className="address-window__identity-text">
          <p className="address-window__username">
            {usernamePending
              ? "Looking up username…"
              : usernameError
                ? "Guest (lookup failed)"
                : username
                  ? `@${username}`
                  : "Unregistered address"}
          </p>
          <p className="address-window__address">{address}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {!accountPending && !accountError && <Freshness dataUpdatedAt={dataUpdatedAt} />}
      {accountError ? (
        <ErrorState
          message={`Could not load this account: ${accountError.message}`}
          onRetry={() => void refetchAccount()}
        />
      ) : accountPending ? (
        <p className="state-line" aria-busy="true">
          Loading account…
        </p>
      ) : (
        <>
          <dl className="account-fields">
            <dt>Status</dt>
            <dd>{info.initialized ? "Active" : "Not initialized"}</dd>
            {info.initialized && (
              <>
                <dt>Balance</dt>
                <dd>{formatBalance(info.balance)}</dd>
                <dt>Account number</dt>
                <dd>{info.accountNumber}</dd>
                <dt>Sequence</dt>
                <dd>{info.sequence}</dd>
              </>
            )}
            <dt>Packages deployed</dt>
            <dd>
              {packageCountPending ? "Checking…" : packageCountError ? "Not available" : packageCount}
            </dd>
          </dl>
          {!info.initialized && (
            <p className="state-line">
              This address has no on-chain activity yet — it has never received funds or sent a
              transaction.
            </p>
          )}
        </>
      )}
      {(network.gnowebUrl || network.explorerUrl) && (
        <p className="address-window__external-links">
          {network.gnowebUrl && (
            <a
              className="address-window__gnoweb-link"
              href={gnowebAddressUrl(network.gnowebUrl, address)}
              target="_blank"
              rel="noopener noreferrer"
            >
              See on gnoweb ↗
            </a>
          )}
          {network.explorerUrl && (
            <button
              type="button"
              onClick={() => openExplorer(mygnoscanAddressUrl(network.explorerUrl as string, address))}
            >
              Open the explorer
            </button>
          )}
        </p>
      )}
    </div>
  );
}
