import { useQueries } from "@tanstack/react-query";
import { InvalidPkgPathError } from "@gnomputer/app-sdk";
import { useSdk } from "../sdk-context";
import { DEDICATED_APPS, type DedicatedApp } from "./dedicated-apps";

/**
 * Which DEDICATED_APPS are actually deployed on the active network.
 *
 * "Deployed on this chain" is a fact, not something that flips back and
 * forth while the app is running (same reasoning as no-render-store), so
 * each check is cached indefinitely once resolved, keyed by network so
 * switching chains re-checks rather than reuses another chain's answer.
 *
 * A confirmed-missing package (InvalidPkgPathError) resolves to `false`
 * rather than rejecting, so it caches cleanly instead of retrying. Any other
 * failure (RPC unreachable, timeout) is left pending/error and treated as
 * "not known to exist" by the caller — an entry never appears from a guess,
 * only once its realm is confirmed live.
 */
export function useAvailableDedicatedApps(): DedicatedApp[] {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  const results = useQueries({
    queries: DEDICATED_APPS.map((app) => ({
      queryKey: ["dedicated-app-exists", networkId, app.pkgPath],
      queryFn: async () => {
        try {
          await sdk.rpc.queryFile(app.pkgPath, new Date().toISOString());
          return true;
        } catch (error) {
          if (error instanceof InvalidPkgPathError) return false;
          throw error;
        }
      },
      staleTime: Infinity,
    })),
  });

  return DEDICATED_APPS.filter((_, i) => results[i]?.data === true);
}
