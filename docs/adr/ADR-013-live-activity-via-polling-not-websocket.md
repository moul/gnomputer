# ADR-013: Live activity via polling, not WebSocket subscription

## Context

ADR-012 deferred live block/transaction streaming to "the first thing to build when this
slice is extended." Extending it that night, `@gnolang/tm2-rpc` does expose a
`WebsocketClient` (`.listen()` returning an `xstream` `Stream`), which would let
`Tm2Client.connect("wss://...")` support real event subscriptions (`tm.event='NewBlock'`
style queries). This is a real, unfamiliar-to-us reactive API (`xstream`, not
Promise/async-iterator based), and its exact subscription query syntax against Gno's
Tendermint2 fork wasn't verified live before commit time.

Decoding transaction contents (to know which function/realm a transaction called, for
real Trail-to-transaction correlation per spec §7.2) is a separate, harder problem:
`Block.txs` is raw amino-encoded bytes, and neither `@gnolang/tm2-rpc` nor
`@gnolang/tm2-js-client` expose a public decoder for Gno's VM message types
(`MsgCall`/`MsgAddPackage`/`MsgRun`). Writing one is a real undertaking with meaningful
risk of subtle bugs that are hard to catch without broad real-world transaction samples.

## Decision

Ship a "Recent activity" panel (`apps/web/src/use-live-activity.ts`) that polls
`status()` every 4 seconds and fetches `block(height)` for any new heights, showing
height, transaction count (`Header.numTxs` — a real field, no decoding needed), and
time. No WebSocket subscription, no transaction message decoding. This is a smaller
feature than the wow-moment described in spec §7.2, but every number it shows is real
and verified against the live network, rather than a subscription integration and a
binary decoder shipped without being able to fully exercise either against live traffic
before committing.

## Consequences

Transaction-to-source correlation (spec §7.2's actual "Live Code" wow moment — seeing
which source symbol a new transaction called) is still not implemented. The activity
feed shows *that* transactions happened, not *what* they did. WebSocket subscription and
amino-based Gno message decoding remain the right next steps, but deserve their own
focused pass with room to verify against real traffic rather than being bolted on here.
