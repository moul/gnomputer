# ADR-018: Topaz's tx-indexer is CORS-enabled — the block on browser queries is lifted

## Status

Accepted. Supersedes the CORS findings in
[ADR-012](./ADR-012-indexer-discovery-rpc-confirmation.md),
[ADR-015](./ADR-015-event-explorer-not-feasible-yet.md), and
[ADR-016](./ADR-016-event-explorer-via-block-results.md). The rest of those
records — in particular ADR-015's and ADR-016's findings about `subscribe`,
and ADR-016's `block_results` decision — still stand.

## Context

ADR-012 and ADR-015 both recorded, from live checks, that Topaz's tx-indexer
served no `access-control-allow-origin` header, so every browser-side call to
it failed at the preflight. That single fact shaped several decisions: the
Event Explorer was built on RPC `block_results` instead of indexer events, and
package enumeration went through `vm/qpaths` rather than
`getTransactions`.

That is no longer true. As of 2026-07-25 the endpoint sends
`access-control-allow-origin: *`, confirmed by a real cross-origin browser
fetch rather than only by curl, and by a live vitest run against the real
endpoint. Re-verified 2026-08-01:

```
$ curl -si -X POST -H 'Origin: https://example.com' \
    -d '{"query":"{ latestBlockHeight }"}' \
    https://indexer.topaz.testnets.gno.land/graphql/query

HTTP/2 200
access-control-allow-origin: *
vary: Origin

{"data":{"latestBlockHeight":358044}}
```

## Decision

Treat the indexer as reachable from the browser. Callers should still handle
network failure as a possible "not available" state — it is now much rarer,
not impossible, and nothing guarantees other networks match Topaz's
configuration.

Nothing built on the old assumption is being torn out. `block_results` works,
`vm/qpaths` is a genuine prefix scan on the node side and has no 10,000-row
cap, and replacing a working path with a second working path buys nothing.
This ADR exists so the *reason* those choices were made isn't mistaken for a
constraint that still applies.

## Consequences

- New features may query the indexer directly from the browser.
- The indexer's real remaining limits are schema-shaped, not transport-shaped,
  and they are the ones to design around: only `getBlocks`,
  `getTransactions`, and `latestBlockHeight` exist; there is no
  `getAccount`-style query, so "what has this address done" means filtering
  `getTransactions` on a message's caller or creator field; there are no
  `gte`/`lte`/`in` operators and no pagination, only `where` and `order`; and
  there is a server-enforced 10,000-row cap per query.
- `getTransactions` returns `null`, not `[]`, when nothing matches.
- The comments in `packages/rpc/src/client.ts` and
  `packages/rpc/src/indexer.ts` that still described the indexer as
  CORS-blocked have been corrected. They contradicted the accurate note at the
  top of `indexer.ts` and would have sent the next reader down a dead end.
