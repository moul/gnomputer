// A small curated set of well-known realms — shared by Realm Browser's home
// tab and World Explorer's "System realms" section. Not sourced from any
// live query: the indexer that could enumerate real deployed realms doesn't
// allow browser access yet (ADR-012/015), so this is deliberately just a
// hand-picked starting point, not a claim of completeness.
export interface KnownRealm {
  label: string;
  packagePath: string;
}

export const KNOWN_REALMS: KnownRealm[] = [
  { label: "Users", packagePath: "gno.land/r/sys/users" },
  { label: "Boards2", packagePath: "gno.land/r/gnoland/boards2/v1" },
  { label: "Blog", packagePath: "gno.land/r/gnoland/blog" },
  { label: "GovDAO", packagePath: "gno.land/r/gov/dao" },
];
