# @gnomputer/lenses

Pure functions for turning chain-authored content into something the UI can
safely render. No DOM, no network, no storage — every export is a function
from data to data, which is why this package has the highest test density in
the workspace.

## What's here

**`safe-url.ts`** — the security boundary. Realm `Render()` output is authored
by whoever deployed the realm and is fully untrusted, and React does **not**
sanitize `href`. `safeExternalUrl` is an allowlist: `http:`, `https:`,
`mailto:`, absolute only. It *rejects* rather than normalizes obfuscated
schemes (`java\nscript:`), and rejects embedded credentials
(`https://evil.com@real.com`, a phishing shape).

**`render-markup.ts`** — `parseRenderMarkup` turns Gno render output into a
`RenderNode` tree. Deliberately not a full markdown parser: it unescapes
Gno's backslash escapes and detects ATX headings **per line**, which is a fix
for realms like `gno.land/r/gov/dao` that pack several headings into one
`\n\n` block.

**`availability.ts`** — which lenses apply to which `EntityKind`, via a
hardcoded `LENS_MATRIX`. Unknown kinds fall back to `["raw"]`.

**`source-symbols.ts`** — imports and exported symbols from `.gno` source. A
lightweight godoc-style pass, not a Go parser; nested and unexported
declarations and const/var blocks are out of scope.

**`user-data.ts`** — parses `r/sys/users` `UserData` out of a qeval dump.

## The two brittle spots

Both parse Gno's *textual* output, which has no schema and can change
upstream without warning:

- `parseUserData`'s regex encodes the **positional field order** of
  `gno.land/r/sys/users.UserData`, because the qeval dump doesn't include
  field names.
- `parseExportedSymbols` is regex-based for the same reason.

If either starts returning nonsense, suspect an upstream struct change before
suspecting the regex.

## Note on the SDK façade

Most of these are surfaced through `sdk.lenses`, but `safeExternalUrl` is
**not** re-exported there — `apps/web` imports it from this package directly,
at the render site.

## Tests

`pnpm --filter @gnomputer/lenses test` — five files, one per module.
