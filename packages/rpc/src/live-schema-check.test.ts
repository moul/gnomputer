import { describe, it, expect } from "vitest";
import {
  listRealms,
  recentEvents,
  realmHistory,
  chainActivityStats,
  listTransactions,
  countPackagesByCreator,
} from "./indexer";

/** Runs the real queries against the real Topaz indexer and checks the
 * per-query schemas accept what actually comes back.
 *
 * Fixture tests prove the schemas accept what we *think* the indexer sends.
 * This one caught what it really sends: `attrs: null` on some events, which
 * `.optional()` rejects because optional means undefined, not null. That
 * would have broken the Event Explorer for every user while every fixture
 * test stayed green.
 *
 * Excluded from the default run — it needs the network and takes seconds.
 *   pnpm --filter @gnomputer/rpc exec vitest run src/live-schema-check.test.ts
 *
 * dailyActivity is deliberately absent: its query scans the whole block
 * range server-side and takes ~58s against Topaz today, well past the 15s
 * deadline. That is a real, separate bug — not a schema problem.
 */
const NETWORK = {
  id: "topaz",
  indexerGraphqlUrl: "https://indexer.topaz.testnets.gno.land/graphql/query",
};
const NOW = new Date().toISOString();

describe.skipIf(!process.env.LIVE_INDEXER)("live indexer responses satisfy the schemas", () => {
  const cases: [string, () => Promise<unknown>][] = [
    ["listRealms", () => listRealms(NETWORK, NOW)],
    ["recentEvents", () => recentEvents(NETWORK, NOW, 20)],
    ["realmHistory", () => realmHistory(NETWORK, "gno.land/r/sys/users", NOW)],
    ["chainActivityStats", () => chainActivityStats(NETWORK, NOW)],
    ["listTransactions", () => listTransactions(NETWORK, NOW, 20)],
    [
      "countPackagesByCreator",
      () => countPackagesByCreator(NETWORK, "g1manfred47kzduec920z88wfr64ylksmdcedlf5", NOW),
    ],
  ];
  for (const [name, run] of cases) {
    it(
      name,
      async () => {
        expect(await run()).toBeDefined();
      },
      60_000
    );
  }
});
