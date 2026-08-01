# ADR-016: Event Explorer, unlocked via RPC `block_results`

> **The CORS findings below are superseded by [ADR-018](./ADR-018-topaz-indexer-is-cors-enabled.md).**
> Topaz's tx-indexer now sends `access-control-allow-origin: *`. Everything
> else in this record still stands.

## Context

ADR-015 concluded no Event Explorer was feasible against Topaz-class networks
because the two obvious event sources are both closed: the indexer's
`events` field has no CORS headers, and RPC `subscribe` isn't registered on
the node. Both conclusions still hold.

That survey did not test a third, distinct Tendermint2 RPC method:
`block_results`. Unlike `subscribe` it's a plain request/response JSON-RPC
call (`{"method": "block_results", "params": {"height": "<h>"}}`), not a
websocket subscription, and unlike the indexer it's served by the same RPC
host as every other query the app already makes — so it isn't subject to
the indexer's CORS policy at all.

Confirmed live against test13 (`rpc.test13.testnets.gno.land`):
- A direct browser `fetch()` to `block_results` for a historical block
  (985592) succeeds with no CORS error and returns real
  `result.results.deliver_tx[].ResponseBase.Events`, each with a
  human-readable `type`, `pkg_path`, and `attrs` — e.g. block 985592's first
  event is a real `Approval` event on `gno.land/p/demo/tokens/grc20`, 22
  events total in that tx.
- A captured fixture of this exact response backs a unit test in
  `packages/rpc/src/client.test.ts` asserting exact real values
  (`gasWanted`, `gasUsed`, event count, first event's shape).
- The polling UI (`use-live-events.ts` + `EventExplorer`) was smoke-tested
  live end-to-end with zero console/page errors; during that particular
  ~15s window test13 simply had no new tx-bearing block, which the fixture
  test and the direct-fetch check above already cover independently.

## Decision

Build the Event Explorer on `block_results`, polled per-height the same way
Recent Blocks polls `status`/`block` (ADR-013's pattern), not on the
indexer or `subscribe`. This partially supersedes ADR-015: the "no reachable
event source" conclusion no longer holds, though the indexer/`subscribe`
findings in ADR-015 remain accurate and unchanged.

## Consequences

- `packages/rpc` gains `fetchBlockResultsRaw` + `RpcClient.getBlockEvents`,
  returning typed `ChainEvent`/`BlockTxResult`/`BlockEvents`.
- Event Explorer polls sequentially from the current tip, same cadence and
  backfill cap as `use-live-activity.ts`, capped to the most recent 40
  events shown.
- This is per-block, not push/live-subscribed — a new block with many
  transactions still means a delay of up to one poll interval before its
  events appear. That's an acceptable tradeoff already established by
  Recent Blocks/Network Monitor elsewhere in the app.
- If `subscribe` is ever registered, or the indexer grows CORS support, the
  `getBlockEvents`-shaped data could be swapped for either without changing
  the `EventExplorer` UI, since it only depends on the `ChainEvent` shape.
