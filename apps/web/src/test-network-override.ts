import type { NetworkConfig } from "@gnomputer/app-sdk";

/** A deterministic network pointed at a locally-running mock RPC, used so
 * end-to-end tests don't depend on the live chain.
 *
 * The e2e suite previously ran against real Topaz, which made CI fail on
 * unrelated PRs whenever the chain was slow or a fixture realm changed
 * shape (AUD-050, and the recurring flake in #87). `apps/mock-server`
 * already existed with fixtures and its own tests but nothing consumed it;
 * this is the seam that lets Playwright point the app at it.
 *
 * Returns null unless VITE_RPC_URL is set, so production builds are
 * completely unaffected — there is no test-only code path at runtime
 * beyond this one env read. */
export function testNetworkOverride(): NetworkConfig | null {
  const rpcUrl = import.meta.env.VITE_RPC_URL;
  if (!rpcUrl) return null;

  return {
    id: "mock",
    name: "Mock (e2e)",
    chainId: "mock-1",
    rpcUrl,
    // Deliberately no indexerGraphqlUrl/explorerUrl/gnockpitUrl: features
    // that need those should render their real "not available on this
    // network" state rather than silently pointing at a live service from
    // a test run.
    environment: "local",
    persistence: "ephemeral",
    trust: "local",
    capabilities: [],
  };
}
