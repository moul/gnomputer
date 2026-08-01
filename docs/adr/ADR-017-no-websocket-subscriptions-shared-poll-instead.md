# ADR-017: One shared height poll, because event subscriptions aren't served

## Context

Three separate hooks (`use-live-events.ts`, `use-live-activity.ts`,
`use-live-transactions.ts`) each hand-roll their own 4-second `getStatus()` loop,
plus `useNetworkStatus` polls every 5s via react-query. Open Event Explorer,
Transaction Explorer and Block Explorer together and the app runs roughly five
concurrent polls all asking the same question — "what is the tip height?" — with
no shared cache and no pause when the tab is hidden. Two audits flagged this
(AUD-024, and the poll-loop finding in the closed #86).

The obvious fix was a websocket "chain clock": subscribe once to `NewBlock` and
fan out. `websocketUrl` already exists in `packages/networks/src/network-config.ts`
(unused), and `@gnolang/gno-js-client` ships a `GnoWSProvider`. ADR-013 had
deferred websockets in 2026-07 because the subscription API was unverified.

## What we actually verified

Probed the real endpoints directly over a raw WebSocket (2026-08-01):

| Endpoint | `status` | `health` | `subscribe` (`tm.event='NewBlock'`) |
|---|---|---|---|
| `wss://rpc.topaz.testnets.gno.land/websocket` | ok | ok | **`-32601 Method not found`** |
| `wss://rpc.gno.land/websocket` | connection error | — | — |

The websocket transport is live on Topaz and speaks JSON-RPC — it just does not
expose `subscribe` at all. Mainnet's websocket doesn't accept a connection.

So a websocket chain clock is **not implementable against the networks we
actually target**, regardless of client library support. This isn't a
client-side gap; the method isn't served.

## Decision

Build the shared layer as **one polled react-query subscription**, not a
websocket one:

- A single `useChainHeight()` query per active network, owned by react-query, so
  every consumer shares one in-flight request and one cache entry.
- It pauses when the document is hidden (`refetchIntervalInBackground: false`),
  which none of the hand-rolled `setTimeout` loops did.
- The live hooks consume that height instead of each calling `getStatus()`.

The transport stays an implementation detail behind `useChainHeight()`, so
swapping in a real subscription later is a change in one file, not five.

## Consequences

- Removes ~4 redundant status polls; background tabs stop polling entirely.
- Latency to notice a new block is unchanged (still the poll interval) — this is
  a load and correctness win, not a freshness win.
- ADR-013's "polling, not websocket" conclusion **stands**, now for a directly
  verified reason rather than an unverified-API one.
- Strengthens the case for a dedicated node (#89): on infrastructure we control
  we could enable the subscription endpoint and upgrade this transport. Until
  then, the "wahoo" live-propagation work (#90) must assume poll cadence.
- Re-run the probe before assuming subscriptions are still unavailable; this is
  a deployment configuration, not a protocol limitation.
