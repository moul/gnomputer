// Realm Render() output is fully untrusted: anyone can deploy a realm, and
// its markdown links flow straight into the UI. React does NOT sanitize
// href attributes (it only warns in development), so a link like
// `[click me](javascript:...)` would otherwise render as a working,
// clickable script-execution vector inside Gnomputer's own origin.
//
// Everything not on this list is refused rather than escaped — an allowlist
// is the only safe posture here, since the dangerous set (javascript:,
// data:, vbscript:, and anything a future browser adds) is open-ended.
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Returns `href` when it is safe to put in an `<a href>` for untrusted
 * (chain- or remote-authored) content, or `undefined` when it isn't — so
 * callers render plain text instead of a link.
 *
 * Rejects, in order: non-absolute/unparseable input, any protocol outside
 * the allowlist (javascript:, data:, vbscript:, file:, custom schemes), and
 * embedded credentials (`https://evil.com@real.com`, a phishing shape).
 * Control characters are rejected too — browsers strip \n/\t inside a URL
 * before parsing, which is how `java\nscript:` payloads sneak past naive
 * string checks; we reject rather than normalize. */
export function safeExternalUrl(href: string | undefined): string | undefined {
  if (!href) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(href)) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    // Not an absolute URL. Deliberately NOT resolved against the current
    // origin: relative hrefs from chain content are handled upstream as
    // realm links (resolveLink), and anything else has no business
    // becoming a link to Gnomputer's own pages.
    return undefined;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return undefined;
  if (parsed.username !== "" || parsed.password !== "") return undefined;

  return href;
}
