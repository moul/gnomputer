export interface ActivityRow {
  packagePath: string;
  eventCount: number;
}

/** Tallies how often each package shows up in a set of recently-seen chain
 * events (use-live-events.ts) — a live, indexer-free stand-in for "what's
 * active right now" (World Explorer's "Recently active" list, and realm
 * path autocomplete's suggestion pool). */
export function rankByActivity(events: { pkgPath: string | null }[]): ActivityRow[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (!event.pkgPath) continue;
    counts.set(event.pkgPath, (counts.get(event.pkgPath) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([packagePath, eventCount]) => ({ packagePath, eventCount }))
    .sort((a, b) => b.eventCount - a.eventCount);
}
