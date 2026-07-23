import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { Freshness } from "./freshness";
import { Window } from "./window";
import { useAddressWindowStore } from "./address-window-store";

function formatBalance(coins: string): string {
  const match = /^(\d+)ugnot$/.exec(coins);
  if (!match) return coins || "0 GNOT";
  const [, amount] = match;
  const gnot = Number(amount) / 1_000_000;
  return `${gnot.toLocaleString(undefined, { maximumFractionDigits: 6 })} GNOT`;
}

export function AddressWindow() {
  const address = useAddressWindowStore((s) => s.currentAddress);

  return (
    <Window
      id="address"
      title={address ? `Address · ${address}` : "Address"}
      accent="cyan"
      startClosed
      defaultGeometry={{ x: 80, y: 80, width: 420, height: 380 }}
    >
      {address ? <AddressContent address={address} /> : <p className="state-line">No address selected yet.</p>}
    </Window>
  );
}

function AddressContent({ address }: { address: string }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
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
  } = useQuery({
    queryKey: ["account", networkId, address],
    queryFn: async () => {
      const env = await sdk.rpc.getAccountInfo(address, new Date().toISOString());
      return env.data;
    },
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
        <p className="state-line" role="alert">
          Could not load this account: {accountError.message}
        </p>
      ) : accountPending ? (
        <p className="state-line" aria-busy="true">
          Loading account…
        </p>
      ) : !info.initialized ? (
        <p className="state-line">
          This address has no on-chain activity yet — it has never received funds or sent a
          transaction.
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
  );
}
