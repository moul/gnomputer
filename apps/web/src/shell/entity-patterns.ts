export type EntityKind = "address" | "username" | "block" | "realm";

// Recognizes the entity references the spec calls out as universally
// clickable wherever they appear in prose: g1... addresses, @usernames,
// #block-numbers, and [domain/]r/foo/bar realm paths. Named groups let a
// single left-to-right scan know which kind matched without re-testing.
// Shared between inline Linkify (matches within free text) and the search
// bar (matches a whole trimmed query).
export const ENTITY_PATTERN_SOURCE = [
  "(?<address>\\bg1[a-z0-9]{25,50}\\b)",
  "(?<username>@[a-zA-Z0-9_]+\\b)",
  "(?<block>#\\d+\\b)",
  "(?<realm>\\b(?:[a-z0-9][a-z0-9.-]*/)?r/[a-z0-9_]+(?:/[a-z0-9_]+)*\\b)",
].join("|");

export function createEntityPattern(): RegExp {
  return new RegExp(ENTITY_PATTERN_SOURCE, "g");
}

function matchedKind(match: RegExpMatchArray): EntityKind | null {
  const entry = Object.entries(match.groups ?? {}).find(([, v]) => v !== undefined);
  return (entry?.[0] as EntityKind | undefined) ?? null;
}

export function matchEntityAt(text: string): { kind: EntityKind; text: string } | null {
  for (const match of text.matchAll(createEntityPattern())) {
    const kind = matchedKind(match);
    if (kind) return { kind, text: match[0] };
  }
  return null;
}

/** Matches when the ENTIRE trimmed string is a single entity reference — for
 * search-bar input, where a bare block height ("126553", no "#") should also
 * count even though it wouldn't be safe to auto-link inline in prose. */
export function matchWholeEntity(text: string): { kind: EntityKind; text: string } | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (/^\d+$/.test(trimmed)) return { kind: "block", text: `#${trimmed}` };
  const whole = new RegExp(`^(?:${ENTITY_PATTERN_SOURCE})$`).exec(trimmed);
  if (!whole) return null;
  const kind = matchedKind(whole);
  return kind ? { kind, text: trimmed } : null;
}
