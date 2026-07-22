# ADR-012: Indexer discovery deferred, RPC-only for Slice 1

## Context

Spec §34 Phase 2 adds a tx-indexer adapter; Slice 1 (Phase 0/1) does not require it.
Research on 2026-07-22 confirmed no publicly hosted GraphQL tx-indexer exists for the
official Test13 testnet — `gnolang/tx-indexer` is designed to be self-hosted against an
RPC endpoint.

While implementing `packages/rpc`, we also confirmed empirically that
`@gnolang/tm2-js-client`'s high-level `Provider` interface does not expose a generic
ABCI query method at all — it only covers accounts/blocks/transactions. Gno-specific VM
queries (`vm/qrender`, `vm/qfile`, `vm/qeval`) require the lower-level
`@gnolang/tm2-rpc`'s `Tm2Client.abciQuery()`. We also found that Gno's VM query results
land in `responseBase.data` (base64), not the standard ABCI `Value` field most Tendermint
tooling reads by default — confirmed live against `gno.land/r/sys/users` on Test13.

## Decision

Slice 1 ships with RPC only (`packages/rpc`, via `@gnolang/tm2-rpc`): `status`,
`vm/qrender`, `vm/qfile`. WebSocket block/tx subscription for live activity is deferred
to the same follow-up as the indexer (not implemented in this slice's shipped code, only
stubbed in `apps/mock-server`). "Recent activity" beyond the initially rendered realm is
therefore not yet part of Slice 1's Home view. The network registry's `test13` entry
carries a `warnings` entry stating that indexed history is unavailable.

## Consequences

Any feature that needs GraphQL-style search or historical aggregation (spec §17.5
Transaction Explorer's search, §24 global search across transactions) waits for Phase 2,
when either a self-hosted tx-indexer is stood up or a public one becomes available. Live
block/transaction streaming for the Home activity feed and Trail-to-transaction
correlation (spec §7.2) is the first thing to build when this slice is extended.
