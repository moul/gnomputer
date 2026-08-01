# Changelog

Notable user-facing changes to Gnomputer, most recent first. Dated by when
they landed on `main`, not by PR number. The in-app "new version available"
banner links here.

## 2026-08-01

- **Data-loss fix:** the Editor discarded recent typing if you switched
  scripts, closed the window, or reloaded within ~0.6s of your last
  keystroke, and silently swallowed failed writes. Pending edits are now
  flushed on all of those paths, `Cmd/Ctrl+S` saves immediately, and the
  toolbar shows unsaved / saving / saved / **not saved** so you always know
  where your work stands.
- **Signing safety:** username registration used to call the wallet
  directly and submit a 1 GNOT transaction the moment you pressed the
  button — no review, no check that your wallet was even on the same chain,
  and it reported success as soon as the wallet accepted it (which is not
  the same as landing on chain). Every signature request now goes through
  one boundary that shows exactly what you're approving (chain, account,
  realm, function, arguments, and how much is being sent, and why), refuses
  outright on a wallet/network chain mismatch, and distinguishes submitted
  from confirmed by waiting for the chain.
- Live views (Event Explorer, Blocks, Transactions, activity feeds) now share
  a single chain-height poll instead of each running their own. With three
  live windows open that's ~3x fewer status requests, and a backgrounded tab
  now stops polling entirely instead of continuing forever.

- **Fixed: the "New version available" Refresh button didn't update the app.**
  Clicking it reloaded the page straight back into the *old* build, and the
  banner reappeared — so it looked permanently broken. The version check
  (which bypasses the service worker) spots a deploy before the worker
  notices it, and in that window the reload was served from the old worker's
  own cache. Refresh now forces a service-worker update check, waits for the
  new worker to finish installing and take control, and only then reloads.

## 2026-07-31

- **Data-loss fix:** the crash screen's one-click "Clear state & reload" deleted
  Gnomputer's entire local database — including your **saved Editor scripts and
  Trails** — while its own text said it "only clears local settings/layout."
  Recovery is now tiered: a plain **Reload** that changes nothing, a **scoped
  reset** that clears only layout/theme/cached chain data (what the old copy
  claimed), and an **erase everything** option behind a confirmation that names
  what will be lost and offers a JSON backup first. Failures are now reported
  instead of silently reloading as if they had worked.
- Production deploys now wait for CI to pass. Previously the deploy workflow ran
  on every push to `main` independently of CI, so a commit that failed
  lint/typecheck/tests/e2e could still ship.
- README corrections: the Editor cannot "run scripts against the chain" (that
  needs transaction signing this guest build doesn't do), the theme family is
  "Modern" not "Clean", and mobile is described honestly as adapting rather than
  reflowing.
- **Security fix:** a realm's `Render()` output could include a
  `javascript:` (or `data:`/`vbscript:`) markdown link, which rendered as a
  real clickable link — React does not sanitize `href` attributes, so
  clicking it would execute that realm author's code inside Gnomputer.
  External links from on-chain content are now allowlisted to
  `http(s)`/`mailto` (rejecting protocol tricks, control-character
  obfuscation, and embedded credentials) and unsafe ones render as plain
  text. Internal realm links are unaffected.

## 2026-07-30

- Fixed a regression: the island bar's hover menus (Chain, Discover,
  Browser, Editor, Settings) stopped showing at all on a narrow viewport.
  Cause: the mobile fix that made the island bar scroll horizontally
  instead of overflowing off-screen also (per the CSS overflow-x/overflow-y
  coupling rule) made it clip its own popovers, which always extend below
  its own short pill. Popovers now render via a portal straight into
  `<body>`, positioned from their trigger's real screen position, so
  they're no longer inside anything that can clip them.

## 2026-07-26

- Windows now play a quick pop-in (fade + scale) when they open instead of
  appearing instantly — respects reduced-motion like every other animation
  in the app.

- Fixed: on a phone-width viewport, the island bar (search, apps, clock)
  was wider than the screen and overflowed off both edges equally —
  the search icon and the clock were genuinely unreachable past the
  viewport's own edge. It now caps to the viewport width and scrolls
  horizontally within its own pill instead, so every icon stays reachable.

- Performance: the Gno/Tendermint2 RPC client stack (@gnolang/tm2-*,
  @cosmjs/*, protobufjs) is now its own build chunk, separate from app
  code — it dropped the main chunk from ~937KB to ~403KB, and a future
  app-only deploy no longer invalidates that ~532KB of rarely-changing
  dependency code for a returning visitor's cache.

- Renamed the "Clean" theme family to "Modern" (matches its own internal
  id, and no longer reads as a near-synonym of the separate "Minimal"
  theme) and darkened its borders and faint/secondary text — both sat
  under a 1.3:1 (border) / 3:1 (faint text) contrast ratio against the
  window background, reading as washed-out. Same fix applied to ASCII ·
  Light and Minimal, the app's two other light themes with the same gap.
- The connection status dot now blinks on any red state, including a
  plain RPC failure ("Failed to fetch") — previously only a fully offline
  browser pulsed; a reachable-but-erroring RPC just sat there static red.
- Settings → Theme: the last row of the grid (Minimal, Cypherpunk) now
  matches every other row's light-left/dark-right order.

## 2026-07-25

- Cypherpunk theme pushed further: a bright scan-band now sweeps top-to-
  bottom across the desktop on its own slow loop, the focused window's
  title gets a brief RGB-split "signal glitch" every ~9s, and buttons get
  a phosphor glow on hover (previously only on focus).
- Omnisearch (⌘K), the Browser's realm-path field, and the Shell's `cd`
  autocomplete now match a real, complete listing of every deployed
  package — including /p/ libraries, not just /r/ realms — so a substring
  like "panictoerr" finds gno.land/p/aeddi/panictoerr from the first
  keystroke, on any network (no indexer required).
- Fixed: Resources → Docs was slow to open — it fetched gnolang/gno's
  entire recursive git tree (~9,600 entries, 2.9MB) just to keep the 73
  under docs/. Now fetches only docs/'s own subtree (~21KB).
- Event Explorer now backfills real recent chain-wide events from the
  indexer immediately on open (networks with one configured), instead of
  starting blank until the next live block happens to carry one — the same
  historical-then-live split the History lens already used for a single
  realm.
- Every embedded third-party page (Explorer, Gnockpit, the Graph lens's
  mygnoscan embed) now has zoom in/out and a refresh button, right before
  its "Open externally" link.
- The Shell now autocompletes: real package paths while typing `cd `, and
  real function names (from the current package) once one is set.
- Fixed: a package with no Render() function (a pure library, or a realm
  that never defined one) showed a generic error on its Render tab —
  Gnomputer now recognizes this and auto-switches to Source, graying out
  the Render tab instead.
- The Source lens's import paths (`gno.land/r/...`/`gno.land/p/...`) are now
  clickable, opening that package's own Source view directly.
- Shell fixes: the prompt no longer floats vertically centered in a mostly-
  empty window; new `help`/`?`, `pwd`, and `ls`/`dir` commands.
- The Chain menu's Gnockpit entry now opens the real embedded dashboard
  directly instead of the native mini-summary page first.
- Added a gnoscan.io link to the Discover menu (opens externally, with the
  active network's real chain ID).
- The Shift+Tab app-switcher overlay now wraps to additional rows instead
  of scrolling horizontally when many windows are open.
- Fixed: Governance (and any other Render() output that packs several
  markdown headings/links onto separate lines without blank-line
  separation, like gno.land/r/gov/dao's real output) rendered literal "#"/
  "##" markers as visible text instead of real headings — a real gap in
  the render-markup parser, not a gov/dao content bug.
- All numbers across the app now format consistently (comma thousands,
  period decimal) regardless of the runtime's locale — previously
  `.toLocaleString()` with no explicit locale could render space-separated
  thousands or a comma decimal depending on OS/browser settings. Chain
  Stats also got a cleaner stat-tile layout and a chart fix so a low-
  activity day is never a near-invisible sliver next to a busy one.
- The Browser hover menu's window list now smart-truncates long realm
  paths (drops "gno.land/", shortens the namespace to its first letter
  before ever touching the realm's own name) instead of relying on plain
  CSS ellipsis, and no longer repeats "Browser" in every row — that stays
  in the menu's own title and each window's real titlebar.
- The Shell app has a new `funcs` command — real function-signature
  introspection (vm/qfuncs) for the current package, so you don't have to
  already know a function's name/params before evaluating a call against
  it. Crossing functions (`cur realm` first param) are flagged `[crossing]`.
- Split "Discover" into five genuinely independent apps — Users, Packages,
  Transactions, Tokens, Governance — each its own window instead of tabs
  inside one shared one. The Discover island icon is now a pure hover
  dropdown listing all five; it has no click-to-open action of its own.
- Transactions now uses the indexer for a real, complete transaction
  history (200 most recent, both successful and failed) instead of only
  what's been seen live since the window opened, on networks with an
  indexer configured.
- Fixed: long realm paths and script names in the Browser/Editor icons'
  hover menus now truncate with an ellipsis instead of overflowing the
  popover.
- Replaced the generic "Embed" window (a plain iframe box with a dynamic
  title) with two dedicated ones: Explorer (mygnoscan) and Gnockpit's
  embed, each a real app identity in its own right. The Faucet entry now
  opens externally instead of embedding, since it's a one-off action.
- Topaz's indexer now allows real browser access — Browser home's "Recently
  deployed" is a real, complete listing instead of only what's been seen
  since the window opened; the History lens shows real historical events
  for a realm, not just live ones from now on; the Accounts window's
  "Packages deployed" count now actually resolves instead of showing "Not
  available".
- New Chain Stats app (⛽): gas/fee totals, top realms and transactions by
  gas, top callers and deployers, and a daily activity chart (blocks/txs
  per day) — aggregated from the whole chain's transaction history.
- The Browser's realm-path field and the Users lookup field now suggest
  real matches from the indexer as you type — realm paths match anywhere
  in the path (not just from "gno.land/" onward), and address lookup
  suggests real recently-active addresses.
- Wallet connect: Settings → User now shows two explicit paths instead of
  one button whose label just changed — Adena (Connect / Install Adena)
  and gnokey (CLI or mobile): paste your address for a real, read-only
  connected identity with a QR code. Registering a username with a
  gnokey-connected address gets a real TxLink + QR instead of a signing
  form Gnomputer can't submit on your behalf.
- Network Monitor, the Address window, and Block Explorer's "Open in
  Explorer" + separate "Embed here" toggle collapsed into one "Open the
  explorer" button; the Discover icon's hover menu now links there too.
- Fixed: the Realm Browser's refresh button was already working (a real
  network round trip fires on click) but gave no visible feedback when the
  refetched content was unchanged — a "✓ Refreshed" confirmation now
  appears every time.

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
