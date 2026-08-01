# @gnomputer/rpc

The chain adapter. Everything the app knows about a live chain enters here
and leaves wrapped in a `DataEnvelope`.

Two clients:

- **`client.ts`** — Tendermint2 RPC. VM queries over `abci_query` (render,
  file, qeval, package JSON, function signatures, package listing) plus
  blocks, block events, accounts, and the validator set.
- **`indexer.ts`** — the tx-indexer's GraphQL API: realm listings, recent
  events, gas statistics, daily activity, transaction lists.

Also `fetch-with-deadline.ts`, which every request goes through.

> **Apps must not import this package.** An eslint `no-restricted-imports`
> rule bans `@gnomputer/rpc` from `apps/web/src/**`. Use
> `@gnomputer/app-sdk`. Tests are exempt.

## The one that catches everyone: ABCI failures are not HTTP failures

A bad package path returns **HTTP 200** with `responseBase.error` set and
`data: null`. `abciQuery()` itself never throws. `queries.ts::abciQueryString`
is the single place that turns that into a thrown error, parsing the human
message out of the Go stack trace after `" - "`. Every error message the user
sees for a missing or broken realm depends on that function.

## Timeouts

`fetchWithDeadline` gives every request a 15s deadline (`DEFAULT_TIMEOUT_MS`)
and **composes** the caller's `AbortSignal` with `AbortSignal.timeout` via
`AbortSignal.any`. Replacing the caller's signal instead of composing would
silently disable react-query's unmount cancellation. A timeout raises
`RequestTimeoutError`, kept distinct from a caller-initiated cancel and from
a transport error, because the UI says different things for each.

## Indexer constraints

Documented at the top of `indexer.ts` and worth reading before adding a
query. The GraphQL schema has only `getBlocks`, `getTransactions`, and
`latestBlockHeight`. There is no `getAccount`, no `gte`/`lte`/`in` operators,
no pagination — `where` and `order` only — and a server-enforced 10,000-row
cap.

`getTransactions` returns `null`, not `[]`, when nothing matches. Callers
must `?? []`.

Validation is at the **envelope** level: `queryIndexer` checks that the
response is JSON, that `errors` is absent, and that `data` is an object. It
does not validate per-query field shapes. That is a deliberate scope
boundary, not an oversight — calling it full payload validation would
overstate what it does.

## Tests

`pnpm --filter @gnomputer/rpc test` — the largest suite in the workspace.
`client.test.ts` runs against captured real-chain fixtures in
`src/__fixtures__/` with `nock` and `disableNetConnect()`, so it never
touches the network.

Note that `apps/mock-server` keeps its **own copy** of four of those fixture
files. Nothing syncs them, so they can drift.
