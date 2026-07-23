# ADR-015: Event Explorer is not feasible yet — no reachable event source

> **Partially superseded by [ADR-016](./ADR-016-event-explorer-via-block-results.md).**
> The indexer and `subscribe` findings below still hold, but a third RPC
> method, `block_results`, was later found to expose real per-tx events
> without CORS issues. An Event Explorer was built on it.

## Context

The spec calls for an Event Explorer showing chain events as they happen. Two
candidate data sources were checked live against Topaz before writing any UI:

1. **Indexer GraphQL `events` field.** Introspecting `TransactionResponse` on
   `indexer.topaz.testnets.gno.land/graphql/query` confirms an `events: [Event]`
   field exists on transaction responses. But ADR-{this session}'s realm-discovery
   work already found that this indexer sends no `Access-Control-Allow-Origin`
   header — its CORS preflight fails, so every browser-side call to it is
   rejected before the request ever reaches the network. This was confirmed both
   via a live Playwright browser run (`net::ERR_FAILED`, explicit CORS message)
   and via a manual `curl -X OPTIONS` preflight showing no ACAO header. The
   `events` field is real, but unreachable from a browser-only app.

2. **RPC WebSocket `subscribe`.** Tendermint-style RPC normally supports a
   `subscribe` JSON-RPC method for live event queries (`tm.event='Tx'` etc.),
   which ADR-013 left as an open possibility (`@gnolang/tm2-rpc` exposes some
   websocket-oriented API, unverified at the time). Tested live this session:
   connecting to `wss://rpc.topaz.testnets.gno.land/websocket` and calling
   `status` over the socket works fine, but calling `subscribe` (both
   object-style and array-style params) returns `{"error": {"code": -32601,
   "message": "Method not found"}}` — the method simply isn't registered on
   this node, independent of which client library would wrap the call.

Both realistic paths to a live Event Explorer are closed for this network today,
not by our own implementation choices but by what the server actually exposes.

## Decision

Do not build an Event Explorer against Topaz right now. Recent Blocks (polling
`status`/`block`, ADR-013) remains the closest available substitute. Revisit if
either of these becomes true:

- The indexer adds CORS headers (or a CORS-enabled proxy is deliberately stood
  up — a real infrastructure decision, not a client-side workaround).
- The RPC node starts registering `subscribe`, or a documented Gno-specific
  equivalent is found.

## Consequences

No new UI was added for this. The Linkify/openRef/search infrastructure built
this session is source-agnostic, so wiring a real Event Explorer in later is a
UI-only addition once a data source exists — no shell rework required.
