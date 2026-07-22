# ADR-001: PWA-first execution model

## Context

Gnomputer's spec (`docs/product/gnomputer-spec.md` §11) defines three execution layers:
PWA, a local companion daemon, and eventual Tauri packaging. Slice 1 must decide which
layer to build first.

## Decision

Ship as an installable web PWA with zero-install guest access. No companion or Tauri
this slice. All read-only browsing (realms, source, activity) works with nothing beyond
a browser tab, talking directly to the public Gno testnet RPC.

## Consequences

Every feature in Slice 1 must degrade gracefully with no local process available.
Wallet, signing, local filesystem, and process management are deferred to their own
phases (spec §34 Phase 7+).
