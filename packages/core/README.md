# @gnomputer/core

`DataEnvelope` — the provenance wrapper that every value crossing an adapter
boundary is carried in.

The point (ADR-004) is that the UI should never be handed a bare value it
can't ask questions about. An envelope records where the data came from
(`source`), how settled it is (`consistency`), how old it is (`freshness`,
`fetchedAt`), which network and block height it reflects, and any `warnings`
the adapter wants to attach. A component that shows a balance can then say
*as of height N, from the indexer* rather than presenting a number as
timeless fact.

## Exports

`DataEnvelopeSchema`, `DataEnvelope<T>`, `wrapEnvelope<T>()`,
`DataWarningSchema`, `DataWarning`.

## Two things worth knowing

**`wrapEnvelope` validates but does not coerce.** It runs `safeParse` and
throws `Invalid DataEnvelope: …` on failure, then returns the *original*
input object rather than zod's parsed output. Nothing is stripped or
converted.

**The payload itself is never validated at runtime.** `DataEnvelopeSchema`
types `data` as `z.unknown()`; the `T` in `DataEnvelope<T>` narrows it at the
type level only. Payload shape is the adapter's responsibility — see the note
on envelope-level validation in `@gnomputer/rpc`.

## Who produces envelopes

`@gnomputer/rpc`, for both the chain client (`source: "rpc"`) and the
tx-indexer (`source: "indexer"`). Consumed through `@gnomputer/app-sdk`.

## Tests

`pnpm --filter @gnomputer/core test`
