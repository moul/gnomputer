// `.toLocaleString()` with no locale argument uses the runtime's default
// locale, which varies by OS/browser settings — confirmed as the cause of
// visibly inconsistent output (space-separated thousands, comma decimals)
// on a real machine. Always forcing "en-US" here guarantees the same
// comma-thousands, period-decimal formatting everywhere regardless of where
// this runs.
export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  return n.toLocaleString("en-US", options);
}

export function formatGnotAmount(amountUgnot: number): string {
  return `${formatNumber(amountUgnot / 1_000_000, { maximumFractionDigits: 6 })} GNOT`;
}

const UGNOT_STRING_RE = /^(\d+)ugnot$/;

/** Formats a "123ugnot"-shaped coin string (the shape RPC responses use)
 * as a GNOT display string — falls back to "0 GNOT" for an empty string,
 * or the input unchanged for anything else that doesn't match. */
export function formatUgnotString(coins: string): string {
  const match = UGNOT_STRING_RE.exec(coins.trim());
  if (!match) return coins || "0 GNOT";
  return formatGnotAmount(Number(match[1]));
}
