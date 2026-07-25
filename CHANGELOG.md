# Changelog

Notable user-facing changes to Gnomputer, most recent first. Dated by when
they landed on `main`, not by PR number. The in-app "new version available"
banner links here.

## 2026-07-24

- Added a "new version available" banner that properly waits for the new
  service worker to take control before reloading, instead of a plain
  reload that could silently still show the old version.
- Custom networks: add your own RPC endpoint from Settings → Network,
  switch to it immediately, and it persists across reloads.
- Embed mygnoscan and Gnockpit inline via an "Embed here" button next to
  their existing external links, instead of only opening in a new tab.
- Added a general "Report a bug" button (island Settings menu, Settings →
  About) that pre-fills a GitHub issue with build/network context — not
  just available after an actual crash.
- Omnisearch (⌘K) now resolves both `@username` and a bare `username` to
  an address via `r/sys/users.ResolveAny`, landing directly on the
  resolved Accounts window.
- Users app shows a "Recently looked up" list, sourced from your own
  Trail (there's no chain-side way to list *everyone's* recent activity —
  chain events carry no signer address).
- Two new themes: Cypherpunk (green-phosphor terminal, scanline texture)
  and Minimal (flattened chrome, no shadows/colored accents) — each with
  genuinely distinct chrome, not just a recolored ASCII/Clean theme.
- Markdown now renders properly in Resources (docs/ and awesome-gno), with
  full folder navigation for the Gno monorepo's own `docs/`.
- Real syntax highlighting in the Source lens; a new Editor app to write,
  save, and run Gno scripts locally, with community-contributed templates.
- Keyboard shortcuts help (`⌘/` or `?`); hovering the Browser icon lists
  every open Browser window (it supports several at once via pop-out).
- Fixed: overview/expose mode no longer bounces back to the grid a beat
  after clicking a window; a real (if rare) bug where a long session's
  window focus churn could let a window's stacking order climb high
  enough to paint over the island bar's own popovers.
- Removed: the taskbar minimize button (and the dead state behind it),
  the "gno.land official pages" shortcut list (not consistently deployed
  across networks), the redundant account-lookup form in Settings → User.
- New Discover app (🔭): Users, Packages (sortable/filterable, real
  package listing), a gnoscan-style Transactions table (one row per
  transaction — status, gas, involved packages — distinct from the live
  per-event Event Explorer), Tokens (native GNOT + the full GRC20
  registry), and Governance (GovDAO proposals) — all real chain data, no
  indexer required.
- Settings: "Report a bug" and "Changelog" are now proper tabs instead of
  external links — the bug tab lets you pick exactly what context to
  attach before it opens the GitHub issue; the changelog tab renders this
  file's real content inline. The island Settings dropdown now has one
  entry per tab, each with a matching emoji.
- Fork a realm's open source file straight into a new Editor script, or
  duplicate an existing one.
- A visual block strip in Block Explorer — literal squares for blocks,
  glow scaled by how busy each one was, click to open its detail.
- Cypherpunk and Minimal themes pushed further from recolored variants:
  Cypherpunk gets a blinking terminal caret, a "> " prompt prefix on
  window titles, a slow CRT flicker, and a dynamic synthwave-style
  background grid; Minimal drops to square corners and a single neutral
  chrome color instead of per-app accents.
- Light themes' window background nudged from pure white to a faint
  off-white.
- Real wallet connect via the Adena browser extension: Settings → User
  shows your real address/balance/chain once connected, and Discover's
  Users tab offers a real "Register username" action (calls the actual
  `gno.land/r/gnoland/users/v1` registration realm) if the connected
  account doesn't have one yet.
- Realm Actions now link to gnoweb's own call form via a real, clickable
  TxLink per function, plus a QR code to continue on another device.
- The Graph lens embeds mygnoscan's real dependency graph (including
  reverse references) instead of showing only direct imports.
- A new "State" lens — a real, expandable tree of a package's persisted
  on-chain state (the same backend gnoweb's own State Explorer uses),
  lazily loading nested objects and resolving struct field names. The
  previous "State" lens (an ad-hoc expression console) is now "Eval".
- A new Shell app (⌨️) — a general-purpose live expression REPL, not
  scoped to one realm/tab: `cd <packagePath>`, then evaluate anything
  against it, with command history.
- Editor and Discover icons get hover menus (10 most recent scripts;
  Users/Packages/Transactions/Tokens/Governance); a Faucet entry was
  added to Discover's menu.
- Shift+Tab now opens an app-switcher overlay — hold Shift, tap Tab to
  cycle through open windows, release to focus one.
- Windows can no longer be dragged (or left, after resizing the browser)
  fully off-screen — at least 20% of a window's width and its whole
  titlebar always stay reachable. The desktop no longer scrolls.
- Test13 removed from the network list.

## Earlier

Everything before this point — the guest-mode read-only PWA itself, the
windowed desktop shell, Trails, the Realm Browser/Source/State/History/
Actions/Graph/Raw lenses, Network/Validator/Block/Event monitoring,
Gnockpit, Users — shipped without a changelog. See `git log` for the full
history; `docs/adr/` for the architectural decisions behind it.
