// A small curated set of well-known realms — shared by the Browser's Home
// tab. Deliberately editorial rather than sourced from a live query — a
// hand-picked starting point, not a claim of completeness. (A real,
// complete listing is available via sdk.indexer.listRealms now that the
// indexer's GraphQL endpoint allows browser access — see "Recently
// deployed" in realm-browser.tsx — but this curated list is still useful
// as a "start here" set independent of deployment recency.)
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
