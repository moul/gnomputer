# ADR-004: DataEnvelope and provenance

## Context

Spec §10 requires every external or cached value to carry provenance so the UI never
silently presents derived data as authoritative.

## Decision

`packages/core`'s `DataEnvelope<T>` wraps every value crossing an adapter boundary with
`source`, `consistency`, `freshness`, and `fetchedAt`. `packages/rpc` is the only
producer this slice (`source: "rpc"`, `consistency: "authoritative"`,
`freshness: "live"`).

## Consequences

When the tx-indexer adapter is added (spec §34 Phase 2), its envelopes will carry
`source: "indexer"` / `consistency: "indexed"`, and any UI that mixes RPC- and
indexer-sourced data must visibly distinguish them per spec §10's core rule: "use the
indexer to discover, use the chain to confirm."
