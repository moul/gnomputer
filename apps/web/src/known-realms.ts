// A small curated set of well-known realms — shared by the Browser's Home
// tab. Not sourced from any live query: the indexer that could enumerate
// real deployed realms doesn't allow browser access yet (ADR-012/015), so
// this is deliberately just a hand-picked starting point, not a claim of
// completeness.
export interface KnownRealm {
  label: string;
  packagePath: string;
  /** True for a core protocol-level realm (r/sys/*, chain governance) —
   * Home splits these into their own "System realms" section, separate
   * from the more editorial "Staff picks". */
  system?: boolean;
}

export const KNOWN_REALMS: KnownRealm[] = [
  { label: "Users", packagePath: "gno.land/r/sys/users", system: true },
  { label: "GovDAO", packagePath: "gno.land/r/gov/dao", system: true },
  { label: "Boards2", packagePath: "gno.land/r/gnoland/boards2/v1" },
  { label: "Blog", packagePath: "gno.land/r/gnoland/blog" },
];
