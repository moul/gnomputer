# Gnomputer

Boot the shared computer.

Gnomputer is the workstation for the Gno shared computer — realm browsing, source
inspection, live chain activity, network and validator health, and (in later slices)
governance actions, wallet operations, and local development, unified into one
inspectable environment.

## This repo right now

This is Slice 1 (plus follow-on features built past its original scope): a guest-mode
read-only PWA with a windowed desktop interface. See:

- `docs/product/gnomputer-spec.md` — the full canonical product spec.
- `docs/superpowers/specs/2026-07-22-slice-1-boot-experience-design.md` — what Slice 1
  actually builds and why.
- `docs/superpowers/plans/2026-07-22-slice-1-boot-experience.md` — the implementation
  plan this slice was built from.
- `docs/adr/` — architecture decision records.

### What's in the desktop

Everything below is real, live data from Gno testnets (default: Topaz; also betanet,
and a local `gnodev` option) — no mocked or fabricated content in the running
app:

- **Browser** — gno.land's own official pages plus any realm's rendered output, with
  Gno's own internal link/pagination routing followed generically; multiple tabs per
  window, and multiple windows at once (pop out a tab into its own window); a Source
  lens with real syntax highlighting shows the realm's file tree and source, fetched
  directly from the chain; URL and search autocomplete against the chain's own package
  list.
- **Editor** — write Gno code, save scripts locally, and load community example
  templates. Running a script against the chain is not available yet: it needs
  transaction signing, which this guest-mode build doesn't do.
- **Resources** — the Gno monorepo's own `docs/` (live, with full folder navigation and
  rendered markdown), the awesome-gno list, and an About page for Gnomputer itself.
- **Users** — look up a registered username or address; results link through to
  Accounts.
- **Network Monitor** — chain ID, live height, measured RPC latency, endpoint trust.
- **Validator Monitor** — the full live validator set: address, voting power, proposer
  priority.
- **Block Explorer** — look up any block by height; header detail plus a real
  per-transaction list (success, gas used/wanted, decoded event types).
- **Event Explorer** — a live stream of decoded chain events as new blocks land.
- **Gnockpit** — a compact chain/validator summary with a link out to the full
  Gnockpit instance for the active network, when one is configured.
- **Accounts** — address lookup: balance, account number, sequence, deployed package
  count, and links out to the same address on gnoweb and a block explorer.
- **History** — every realm/block/address you've visited this session, recorded as a
  Trail.
- **Settings** — Network (switch networks, see all known endpoints for one), User
  (guest identity, address lookup), and Theme (six: ASCII and Modern each in light/dark,
  plus Cypherpunk and Minimal).

Windows are draggable, resizable, and closable; an overview/expose mode (click the
desktop background) shows every open window at once, with a close-all button and a
per-window close button of its own. Unopened apps live behind the island bar's icons
and a command palette (⌘K). Layout, theme, and zoom persist across reloads, and a
banner appears if a newer build has been deployed while you had the page open.

The desktop metaphor is built for a real screen. On a phone it adapts rather than
reflows — a fresh mobile visit gets a zoomed-out, maximized-window default — so it
is usable but not yet a first-class mobile layout.

## Development

```bash
npm i -g pnpm@9.15.0
pnpm install
pnpm dev      # apps/web on http://localhost:5173
pnpm test     # all package unit tests
pnpm --filter @gnomputer/web e2e   # Playwright
pnpm build
```

Default network: Topaz. Switch networks from the island bar's Settings icon (Network
tab), which also lists every other endpoint (gnoweb, tx-indexer, Gnockpit, explorer)
known for the active network.
