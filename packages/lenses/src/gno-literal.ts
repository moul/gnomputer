/** Maximum length accepted for a value that will be embedded in a qeval
 * expression. Gno usernames are far shorter than this and a bech32 address is
 * ~40 characters; the cap exists so a megabyte of text can't be turned into a
 * megabyte of expression for a public node to parse. */
export const MAX_GNO_STRING_LENGTH = 256;

export class GnoStringTooLongError extends Error {
  constructor(length: number) {
    super(`Value is ${length} characters; the maximum is ${MAX_GNO_STRING_LENGTH}.`);
    this.name = "GnoStringTooLongError";
  }
}

const SIMPLE_ESCAPES: Record<string, string> = {
  "\\": "\\\\",
  '"': '\\"',
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
};

/** Encodes a value as a Go/Gno interpreted string literal, quotes included.
 *
 * Call sites used to build qeval expressions by interpolation —
 * `ResolveAny("${input}")` — with input straight from a text field. A value
 * containing a quote closes the literal early and the rest is parsed as Gno
 * expression syntax. These are read-only `qeval` calls against a public node,
 * so the realistic damage is a malformed or expensive expression rather than
 * an on-chain write, but "the query is read-only" is not a reason to let
 * someone else finish writing it.
 *
 * Everything outside the printable ASCII range is emitted as an escape rather
 * than passed through: a literal newline is not legal inside a Go interpreted
 * string literal at all, and invisible characters in an expression are worth
 * making visible. */
export function encodeGnoString(value: string): string {
  if (value.length > MAX_GNO_STRING_LENGTH) throw new GnoStringTooLongError(value.length);

  let out = '"';
  for (const char of value) {
    const simple = SIMPLE_ESCAPES[char];
    if (simple !== undefined) {
      out += simple;
      continue;
    }
    const code = char.codePointAt(0)!;
    if (code >= 0x20 && code < 0x7f) {
      out += char;
    } else if (code <= 0xff) {
      out += `\\x${code.toString(16).padStart(2, "0")}`;
    } else if (code <= 0xffff) {
      out += `\\u${code.toString(16).padStart(4, "0")}`;
    } else {
      out += `\\U${code.toString(16).padStart(8, "0")}`;
    }
  }
  return `${out}"`;
}
