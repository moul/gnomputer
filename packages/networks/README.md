# @gnomputer/networks

The network registry: a schema for what a Gno network configuration is, and
the five built-in entries.

- **pearl** — the newest official testnet, and the default.
- **sapphire** — the one behind Pearl, and the fallback: still a first-class
  selectable network, a menu entry away.
- **topaz** — an earlier default, still selectable.
- **betanet**
- **gnodev** — a local development node. Never the default; a test asserts
  that, because it requires a `gnodev` you're running yourself.

Changing the default only affects a session with no stored choice — a first
visit, or one whose storage was cleared. A stored `active-network` always
wins, so nobody is moved off the chain they picked (AUD-013).

## Exports

`NetworkConfigSchema`, `NetworkConfig`, `DEFAULT_NETWORKS`,
`DEFAULT_NETWORK_ID` (`"pearl"`).

## Adding a network

`websocketUrl` is derived, not written by hand: a private `withWebsocket()`
helper rewrites `http` → `ws` and appends `/websocket`. A test asserts this
invariant for *every* entry, so a new network that hardcodes a websocket URL
will fail it.

All URL fields are `z.string().url()`, so hostless or relative values are
rejected outright.

## Live-verified notes in the source

The comments in `default-networks.ts` record things that were checked against
the real endpoints and are easy to get wrong:

- The user-facing `topaz.testnets.gno.land` is **gnoweb**, not the RPC. The
  RPC is `rpc.topaz.testnets.gno.land`.
- Topaz's `explorerUrl` sends no CORS header, so it is a link-out only —
  nothing can fetch from it.
- Betanet's `gnockpitUrl` and `explorerUrl` are community-run even though the
  network's `trust` is `official`.

Related: ADR-017 records that no Gno RPC endpoint currently serves event
subscriptions — `subscribe` returns `-32601 Method not found` — so
`websocketUrl` is not yet used for live data anywhere.

## Tests

`pnpm --filter @gnomputer/networks test`
