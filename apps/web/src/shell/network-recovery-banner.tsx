import { useState } from "react";
import { useSdk } from "../sdk-context";

/** Says so when the network you were on could not be restored.
 *
 * The failure mode this exists for is silent: a custom network gets removed
 * (or its stored definition is lost) and the next visit puts you on the
 * default instead. The UI looks identical, the data is from a different
 * chain, and nothing tells you (AUD-013). */
export function NetworkRecoveryBanner({ unresolvedNetworkId }: { unresolvedNetworkId: string | null }) {
  const sdk = useSdk();
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!unresolvedNetworkId || dismissed === unresolvedNetworkId) return null;

  return (
    <div className="update-banner network-recovery-banner" role="alert">
      <span>
        The network you were using (<code>{unresolvedNetworkId}</code>) is no longer configured.
        You&rsquo;re on {sdk.networks.getDefault().name} instead.
      </span>
      <button type="button" onClick={() => setDismissed(unresolvedNetworkId)}>
        Dismiss
      </button>
    </div>
  );
}
