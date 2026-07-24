const DOMAIN_PREFIX_RE = /^[^/]+\//;
const MIDDLE_SEGMENT_BUDGET = 4;

function truncateMiddle(segment: string, maxLen: number): string {
  if (segment.length <= maxLen) return segment;
  if (maxLen <= 3) return segment.slice(0, maxLen);
  const keep = maxLen - 2;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${segment.slice(0, head)}..${segment.slice(segment.length - tail)}`;
}

/** Formats a package path for compact display (tab labels, taskbar items):
 * drops the leading domain ("gno.land/") since every realm shares it, then
 * — if it's still too long — shortens earlier path segments to the middle
 * ("m..l") before ever touching the last segment, since the last segment
 * (the realm's own name) is the most identifying part. Only falls back to
 * shortening the last segment once every earlier one is already minimal. */
export function formatRealmLabel(packagePath: string, maxLength = 22): string {
  const withoutDomain = packagePath.replace(DOMAIN_PREFIX_RE, "");
  if (withoutDomain.length <= maxLength) return withoutDomain;

  const segments = withoutDomain.split("/");
  const lastIndex = segments.length - 1;

  for (let shortenUpTo = 0; shortenUpTo < lastIndex; shortenUpTo++) {
    const attempt = segments.map((seg, i) => (i <= shortenUpTo ? truncateMiddle(seg, MIDDLE_SEGMENT_BUDGET) : seg));
    const joined = attempt.join("/");
    if (joined.length <= maxLength) return joined;
  }

  const everyOtherShortened = segments.map((seg, i) =>
    i < lastIndex ? truncateMiddle(seg, MIDDLE_SEGMENT_BUDGET) : seg
  );
  let lastLen = segments[lastIndex]!.length;
  let result = everyOtherShortened.join("/");
  while (result.length > maxLength && lastLen > MIDDLE_SEGMENT_BUDGET) {
    lastLen -= 1;
    const attempt = [...everyOtherShortened];
    attempt[lastIndex] = truncateMiddle(segments[lastIndex]!, lastLen);
    result = attempt.join("/");
  }
  return result;
}
