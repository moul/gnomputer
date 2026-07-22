import type { EntityKind, EntityRef } from "./entity-ref";

export class InvalidUriError extends Error {
  constructor(uri: string, reason: string) {
    super(`Invalid gno:// URI "${uri}": ${reason}`);
    this.name = "InvalidUriError";
  }
}

const PATH_KIND_MAP: Record<string, EntityKind> = {
  realm: "realm",
  package: "package",
  function: "function",
  address: "address",
  identity: "identity",
  account: "account",
  tx: "transaction",
  block: "block",
  proposal: "proposal",
  validator: "validator",
  workspace: "local-workspace",
  trail: "trail",
};

export function parseGnoUri(uri: string): EntityRef {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new InvalidUriError(uri, "not a valid URL");
  }

  if (parsed.protocol !== "gno:") {
    throw new InvalidUriError(uri, `expected "gno://" scheme, got "${parsed.protocol}"`);
  }

  const networkId = parsed.host;
  if (!networkId) {
    throw new InvalidUriError(uri, "missing network segment");
  }

  const segments = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const [kindSegment, ...rest] = segments;
  const kind = kindSegment ? PATH_KIND_MAP[kindSegment] : undefined;
  if (!kind) {
    throw new InvalidUriError(uri, `unknown or missing entity kind "${kindSegment ?? ""}"`);
  }

  const ref: EntityRef = { uri, kind, networkId };

  if (kind === "realm" || kind === "package" || kind === "function") {
    ref.packagePath = rest.join("/");
  } else if (
    kind === "address" ||
    kind === "identity" ||
    kind === "account" ||
    kind === "transaction" ||
    kind === "block" ||
    kind === "local-workspace" ||
    kind === "trail" ||
    kind === "validator"
  ) {
    ref.objectId = rest.join("/");
  } else if (kind === "proposal") {
    ref.packagePath = rest.slice(0, -1).join("/");
    ref.objectId = rest[rest.length - 1];
  }

  if (parsed.hash) {
    ref.functionName = parsed.hash.slice(1);
  }

  return ref;
}

export function formatGnoUri(
  ref: Pick<EntityRef, "networkId" | "kind" | "packagePath" | "objectId" | "functionName">
): string {
  const kindSegment = Object.entries(PATH_KIND_MAP).find(([, v]) => v === ref.kind)?.[0];
  if (!kindSegment) {
    throw new InvalidUriError("(formatting)", `no URI segment registered for kind "${ref.kind}"`);
  }
  const pathPart = ref.packagePath ?? ref.objectId ?? "";
  const fragment = ref.functionName ? `#${ref.functionName}` : "";
  return `gno://${ref.networkId}/${kindSegment}/${pathPart}${fragment}`;
}
