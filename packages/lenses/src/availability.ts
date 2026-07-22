import type { EntityKind, LensId } from "@gnomputer/entities";

const LENS_MATRIX: Record<EntityKind, LensId[]> = {
  network: ["state", "history", "raw"],
  realm: ["experience", "source", "docs", "state", "history", "actions", "graph", "raw"],
  package: ["source", "docs", "graph", "raw"],
  "source-file": ["source", "raw"],
  function: ["source", "docs", "actions", "raw"],
  type: ["source", "docs", "raw"],
  "state-object": ["state", "raw"],
  address: ["state", "history", "raw"],
  identity: ["experience", "state", "history", "raw"],
  account: ["state", "history", "actions", "raw"],
  balance: ["state", "raw"],
  transaction: ["history", "raw", "graph"],
  "transaction-message": ["history", "raw"],
  block: ["history", "raw"],
  event: ["history", "raw"],
  proposal: ["experience", "history", "actions", "raw"],
  validator: ["experience", "state", "history", "raw"],
  "local-workspace": ["source", "raw"],
  "local-file": ["source", "raw"],
  process: ["state", "raw"],
  trail: ["graph", "raw"],
};

export function availableLenses(kind: EntityKind): LensId[] {
  return LENS_MATRIX[kind] ?? ["raw"];
}

export function lensUnavailableReason(kind: EntityKind, lens: LensId): string | null {
  if (availableLenses(kind).includes(lens)) return null;
  return `The "${lens}" lens is not applicable to entities of kind "${kind}".`;
}
