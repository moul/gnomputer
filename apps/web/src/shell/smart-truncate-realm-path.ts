const DOMAIN_PREFIX_RE = /^[^/]+\//;
const ELLIPSIS = "…";

function truncateMiddle(segment: string, maxLen: number): string {
  if (segment.length <= maxLen) return segment;
  if (maxLen <= 1) return ELLIPSIS;
  const keep = maxLen - 1;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${segment.slice(0, head)}${ELLIPSIS}${segment.slice(segment.length - tail)}`;
}

/** Formats a package path for a narrow display (the Browser hover menu's
 * window list): drops the leading domain ("gno.land/") since every realm
 * shares it, then — only if it's still too long — shortens the namespace
 * (the segment right after "r"/"p") down to its first letter + an ellipsis,
 * since it's the least identifying part (an address or org name, not the
 * realm itself). Only once THAT still isn't enough does it also
 * middle-truncate the package name (everything after the namespace).
 *
 * Deliberately a different, more aggressive algorithm than
 * format-realm-label.ts's formatRealmLabel (used for tab labels/taskbar
 * items, which has its own established, separately-tuned behavior) — this
 * one is for a much narrower context (a popover list, not a whole
 * titlebar), and per explicit design: truncate the namespace to just its
 * first letter first (not a symmetric middle-truncation), before ever
 * touching the package name. */
export function smartTruncateRealmPath(packagePath: string, maxLength = 28): string {
  const withoutDomain = packagePath.replace(DOMAIN_PREFIX_RE, "");
  if (withoutDomain.length <= maxLength) return withoutDomain;

  const segments = withoutDomain.split("/");
  if (segments.length < 3) {
    // No real kind/namespace/package structure to work with (e.g. just
    // "r/demo" or a bare name) — fall back to a plain middle-truncation of
    // the whole thing.
    return truncateMiddle(withoutDomain, maxLength);
  }

  const [kind, namespace, ...rest] = segments as [string, string, ...string[]];
  const packageName = rest.join("/");

  const shortNamespace = namespace.length > 1 ? `${namespace[0]}${ELLIPSIS}` : namespace;
  const withShortNamespace = `${kind}/${shortNamespace}/${packageName}`;
  if (withShortNamespace.length <= maxLength) return withShortNamespace;

  const overhead = withShortNamespace.length - packageName.length;
  const packageBudget = Math.max(3, maxLength - overhead);
  return `${kind}/${shortNamespace}/${truncateMiddle(packageName, packageBudget)}`;
}
