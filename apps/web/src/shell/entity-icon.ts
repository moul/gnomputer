const KIND_ICON: Record<string, string> = {
  realm: "🌐",
  "source-file": "📄",
  address: "👤",
  block: "🧱",
  settings: "⚙",
};

/** Icon for a trail/history entry's ref URI, based on its gno://.../<kind>/... segment. */
export function iconForRefUri(uri: string): string {
  const match = /^gno:\/\/[^/]+\/([a-z-]+)\//.exec(uri);
  const kind = match?.[1];
  return (kind && KIND_ICON[kind]) || "•";
}
