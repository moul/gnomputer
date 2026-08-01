# @gnomputer/mock-server

A fixture-serving stand-in for a Gno/Tendermint node, so the Playwright suite
doesn't depend on the live chain.

Running e2e against real Topaz made CI fail on unrelated PRs whenever the
chain was slow or a fixture realm changed shape (AUD-050). The suite now runs
in ~5s and is deterministic.

## Running it

Playwright starts it automatically — it's the first `webServer` entry in
`apps/web/playwright.config.ts`, and the app is pointed at it via
`VITE_RPC_URL`.

To run it by hand:

```bash
pnpm --filter @gnomputer/mock-server start   # http://127.0.0.1:26658
```

Port is `MOCK_RPC_PORT`, default **26658** — one past Tendermint's
conventional 26657, so it can't collide with a real local node.

## What it answers

Any POST is dispatched on the JSON-RPC method:

| request | fixture |
|---|---|
| `status` | `status.json` |
| `abci_query`, path starting `vm/qpaths` | `qpaths.json` |
| `abci_query`, path `vm/qfile` | `qfile.json` |
| `abci_query`, any other path | `qrender.json` |
| anything else | `{ result: {} }` |

`vm/qpaths` is matched by **prefix** because the real path carries
`?limit=2000`.

It also answers CORS preflight `OPTIONS`. That is not optional: a JSON-RPC
POST triggers a preflight, and without a response to it the browser never
sends the real request — the app just shows "Failed to fetch".

A WebSocket server on the same port broadcasts a
`tendermint/event/NewBlock` message every 3s. Note this is *not* what the
real chain does: per ADR-017, Gno RPC returns `-32601 Method not found` for
`subscribe`.

## Fixtures can drift

`src/__fixtures__/` holds copies of four fixture files that also exist in
`packages/rpc/src/__fixtures__/`. Nothing syncs them.

Fixtures are read relative to the *compiled* module URL, which is why the
build script has an explicit `cp` step — `tsc` doesn't copy JSON, and
`dist/start.js` fails without it.

Responses ignore request params beyond `method` and `params.path`.

## Library use

`createMockServer(port = 0)` returns a handle with `url`, `wsUrl`, and
`close()`. Passing `0` takes an ephemeral port, which is how its own unit
test runs it in-process.
