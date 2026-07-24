// A curated, hand-picked subset of this repo's own docs/ folder — fetched
// live from GitHub rather than bundled at build time, so this doesn't grow
// the app bundle and always reflects whatever's actually on `main`. Only
// docs/adr/** and docs/product/** are listed; docs/superpowers/** is
// internal planning material, not user-facing documentation.
export interface KnownDoc {
  label: string;
  path: string;
}

export const KNOWN_DOCS: KnownDoc[] = [
  { label: "Product spec", path: "docs/product/gnomputer-spec.md" },
  { label: "ADR-001 · PWA-first execution model", path: "docs/adr/ADR-001-pwa-first-execution-model.md" },
  { label: "ADR-002 · EntityRef and lenses", path: "docs/adr/ADR-002-entityref-and-lenses.md" },
  { label: "ADR-003 · Trails as a core primitive", path: "docs/adr/ADR-003-trails-as-core-primitive.md" },
  { label: "ADR-004 · Data envelope and provenance", path: "docs/adr/ADR-004-data-envelope-and-provenance.md" },
  {
    label: "ADR-012 · Indexer discovery, RPC confirmation",
    path: "docs/adr/ADR-012-indexer-discovery-rpc-confirmation.md",
  },
  {
    label: "ADR-013 · Live activity via polling, not websocket",
    path: "docs/adr/ADR-013-live-activity-via-polling-not-websocket.md",
  },
  { label: "ADR-014 · Windowed desktop shell", path: "docs/adr/ADR-014-windowed-desktop-shell.md" },
  {
    label: "ADR-015 · Event Explorer not feasible yet",
    path: "docs/adr/ADR-015-event-explorer-not-feasible-yet.md",
  },
  {
    label: "ADR-016 · Event Explorer via block results",
    path: "docs/adr/ADR-016-event-explorer-via-block-results.md",
  },
];
