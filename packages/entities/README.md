# @gnomputer/entities

The vocabulary every other package shares: what a thing on the chain *is*,
and how to name it in a URI.

A leaf package — it depends on nothing in this workspace, which is why
everything else can depend on it.

## What's here

**`EntityRef`** — the identity of anything the app can point at: a realm, a
package, a block, an address, a transaction. `EntityKind` and `LensId` are
closed enums, deliberately. Per ADR-002, adding a lens means editing this
package and `@gnomputer/lenses` together; there is no registration hook, so
the set of lenses is knowable by reading one file.

**`gno://` URIs** — `parseGnoUri` and `formatGnoUri`, the two directions of
the app's addressing scheme.

## Two things that will bite you

**Not every `EntityKind` is URI-representable.** The private `PATH_KIND_MAP`
in `uri.ts` is the single source of truth for both directions, and it covers
12 of the 21 kinds. `formatGnoUri` throws `InvalidUriError` for a kind with
no registered segment — `source-file`, `state-object`, `balance`, `event`,
and others are in-memory kinds only.

**Segment names don't always match kind names.** The URI segment `tx` maps to
the kind `transaction`, and `workspace` maps to `local-workspace`. Read the
map, don't guess from the enum.

`parseGnoUri` is built on `new URL()`, so the network is the URL *host*, and
a fragment becomes `functionName`.

## Tests

`pnpm --filter @gnomputer/entities test`
