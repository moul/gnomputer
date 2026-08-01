const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

/** BIP-173's own limit. Gno addresses are 40 characters; this only rules out
 * absurd input. */
const MAX_LENGTH = 90;

/** Gno addresses are 20-byte account IDs under the "g" human-readable part. */
export const GNO_ADDRESS_HRP = "g";
const GNO_ADDRESS_BYTES = 20;

function polymod(values: number[]): number {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GENERATOR[i]!;
  }
  return chk;
}

function expandHrp(hrp: string): number[] {
  const high: number[] = [];
  const low: number[] = [];
  for (let i = 0; i < hrp.length; i++) {
    const code = hrp.charCodeAt(i);
    high.push(code >> 5);
    low.push(code & 31);
  }
  return [...high, 0, ...low];
}

/** Regroups 5-bit bech32 data into 8-bit bytes, rejecting the padding shapes
 * BIP-173 forbids — a non-zero remainder, or more than four leftover bits. */
function fiveToEight(data: number[]): number[] | null {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const value of data) {
    acc = (acc << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  if (bits >= 5 || ((acc << (8 - bits)) & 0xff) !== 0) return null;
  return out;
}

export interface Bech32Decoded {
  hrp: string;
  bytes: number[];
}

/** Decodes a bech32 string, verifying its checksum.
 *
 * Returns null rather than throwing: every caller is validating user input,
 * where "this isn't a valid address" is an expected answer, not an
 * exceptional one. */
export function decodeBech32(input: string): Bech32Decoded | null {
  if (input.length < 8 || input.length > MAX_LENGTH) return null;

  // Mixed case is explicitly invalid — it would make the checksum ambiguous.
  const hasLower = input !== input.toUpperCase();
  const hasUpper = input !== input.toLowerCase();
  if (hasLower && hasUpper) return null;

  const value = input.toLowerCase();
  const separator = value.lastIndexOf("1");
  // The data part must hold at least the six checksum characters.
  if (separator < 1 || separator + 7 > value.length) return null;

  const hrp = value.slice(0, separator);
  for (let i = 0; i < hrp.length; i++) {
    const code = hrp.charCodeAt(i);
    if (code < 33 || code > 126) return null;
  }

  const data: number[] = [];
  for (const char of value.slice(separator + 1)) {
    const index = CHARSET.indexOf(char);
    if (index === -1) return null;
    data.push(index);
  }

  if (polymod([...expandHrp(hrp), ...data]) !== 1) return null;

  const bytes = fiveToEight(data.slice(0, -6));
  if (!bytes) return null;
  return { hrp, bytes };
}

/** True only for a well-formed Gno address: "g" HRP, valid checksum, and a
 * 20-byte payload.
 *
 * This used to be `/^g1[a-z0-9]{25,50}$/`, which accepts any string of
 * roughly the right shape — a typo'd or truncated address passes, and the
 * app goes on to query the chain for an account that cannot exist. The
 * checksum is the entire reason bech32 exists; not checking it throws away
 * the one guarantee the format offers. */
export function isValidGnoAddress(address: string): boolean {
  const decoded = decodeBech32(address.trim());
  return decoded?.hrp === GNO_ADDRESS_HRP && decoded.bytes.length === GNO_ADDRESS_BYTES;
}
