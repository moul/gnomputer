import { APP_REGISTRY, type AppDescriptor } from "./app-registry";

/** Apps matching a palette query, best first.
 *
 * The README says "unopened apps live behind the island bar's icons and a
 * command palette (⌘K)". The island half was true; the palette only ever
 * resolved entities, so the claim was half false — you could not reach a
 * single app from it (AUD-046).
 *
 * Includes apps hidden from the island. Those are reachable only
 * contextually today (a trail step, an entity link), which makes the
 * palette the one place they can be found deliberately rather than
 * stumbled into.
 *
 * A prefix match ranks above a substring one so typing "ed" puts Editor
 * before Block Explorer — "contains" alone makes short queries feel random.
 */
export function matchApps(query: string, limit = 6): AppDescriptor[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];

  const scored: { app: AppDescriptor; rank: number }[] = [];
  for (const app of APP_REGISTRY) {
    const label = app.label.toLowerCase();
    if (label === needle) scored.push({ app, rank: 0 });
    else if (label.startsWith(needle)) scored.push({ app, rank: 1 });
    else if (label.includes(needle)) scored.push({ app, rank: 2 });
  }

  return scored
    .sort((a, b) => a.rank - b.rank || a.app.label.localeCompare(b.app.label))
    .slice(0, limit)
    .map((s) => s.app);
}
