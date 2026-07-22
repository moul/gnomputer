# Gnomputer — Canonical Product and Implementation Specification

**Tagline:** Boot the shared computer.

**Status:** Implementation-ready
**Primary delivery:** Web PWA
**Privileged extension:** Local Go companion
**Future packaging:** Tauri desktop application

**Source:** https://gist.github.com/moul/676ef6d55c12bd8ecaaddd15f5f92102

> This is the full, long-range product spec. It describes a multi-year roadmap (16 build
> phases, 9 vertical slices, ~20 bundled apps, a Go companion daemon, a plugin system, and
> Tauri packaging). It is kept here verbatim as the canonical reference. Individual build
> cycles are scoped down from this document into their own design docs under
> `docs/superpowers/specs/` — see `docs/superpowers/specs/2026-07-22-slice-1-boot-experience-design.md`
> for the first one.

---

# 1. Product definition

Gnomputer is the workstation for the Gno shared computer.

It unifies:

- realm browsing;
- source inspection;
- state exploration;
- transaction and block exploration;
- identities and accounts;
- governance;
- wallet operations;
- arbitrary `maketx run` programs;
- local development;
- debugging;
- process management;
- validator and network operations.

Gnomputer must make Gno feel like a living, inspectable and programmable computer rather than a collection of blockchain websites.

It is not merely:

- a blockchain explorer;
- a wallet;
- an IDE;
- a web desktop;
- a wrapper around `gnoweb`;
- a graphical version of `gnokey`.

It is the environment from which users can **observe, understand, act on, program and operate** Gno.

---

# 2. Core product promise

A new visitor must understand the shared-computer concept within 60 seconds, without:

- creating an account;
- connecting a wallet;
- installing software;
- reading documentation;
- understanding blockchain terminology.

An experienced user must eventually be able to:

1. inspect a realm;
2. understand its source and state;
3. follow its activity;
4. execute actions safely;
5. convert actions into code;
6. fork the realm locally;
7. test and debug changes;
8. deploy them;
9. monitor the systems supporting the network.

---

# 3. Product thesis

The most important abstraction is not the desktop.

It is:

```text
Shared computer
    ↓
Objects
    ↓
Lenses
    ↓
Actions
    ↓
Programs
```

Windows, tabs and split panes are presentation mechanisms.

The durable product model is:

- everything meaningful is an object;
- every object has inspectable lenses;
- every permitted action produces an explicit intent;
- every action can progressively reveal its technical form;
- many actions can become editable programs.

---

# 4. The memorable primitive: Trails

Gnomputer's distinctive primitive is the **Trail**.

A Trail is a persistent, inspectable path through the shared computer.

Examples:

```text
Proposal
→ author
→ creation transaction
→ called function
→ source
→ state change
```

```text
Failed transaction
→ error
→ source line
→ state dependency
→ local replay
→ fix
→ redeployment
```

```text
Realm action
→ transaction intent
→ gnokey command
→ Run program
→ local workspace
```

A Trail records:

- visited objects;
- selected lenses;
- relevant relationships;
- block-height context;
- user notes;
- transaction drafts;
- generated scripts;
- local workspace links.

Trails make investigations resumable, shareable and programmable.

They are to Gnomputer what:

- repositories are to Git;
- containers are to Docker;
- notebooks are to Jupyter;
- scenes are to game engines.

## 4.1 Trail capabilities

Users can:

- start a Trail from any object;
- add objects manually;
- capture navigation automatically;
- pin relevant state;
- annotate steps;
- share a read-only Trail;
- replay compatible steps;
- convert action sequences into macros;
- convert transaction-related steps into a Run program;
- fork a Trail into a local development workspace.

## 4.2 Trail UX

The Trail appears as a subtle breadcrumb graph, not a mandatory workflow system.

Example:

```text
GovDAO #12
 › Alice
 › Tx 4A21…
 › MustVoteOnProposal()
 › members["alice"]
```

The user can expand it into a full graph when needed.

---

# 5. Tone and identity

Gnomputer should feel:

- fun through discovery;
- professional through precision;
- memorable through language and interaction;
- trustworthy through explicit boundaries;
- powerful through progressive disclosure.

Avoid childish gamification.

Do not use:

- XP;
- streaks;
- loot metaphors;
- casino animations;
- fake terminal theatrics;
- excessive gnome jokes;
- decorative draggable windows with no functional value.

Use restrained product language:

```text
Boot the shared computer.
The world is live.
Browsing as guest.
Nothing has been signed.
Open the machine room.
Fork this realm locally.
This action can become a program.
A new version of this realm appeared.
```

The gnome identity should exist as subtle character, visual identity and mascot—not as a joke in every label.

---

# 6. Progressive capability model

The product has five user states.

## 6.1 Guest

Capabilities:

- browse;
- search;
- inspect;
- follow Trails;
- open source;
- inspect current public state;
- inspect transactions;
- use curated workspaces.

No identity or wallet required.

## 6.2 Observer

Additional capabilities:

- save layouts;
- save Trails;
- create watchlists;
- bookmark entities;
- save transaction drafts;
- install the PWA;
- maintain private local history.

Still no wallet required.

## 6.3 Participant

Unlocked by connecting a wallet.

Additional capabilities:

- send funds;
- call realm functions;
- vote;
- publish transactions;
- sign Run programs;
- track personal activity.

## 6.4 Builder

Unlocked through the local companion.

Additional capabilities:

- manage local projects;
- fork source;
- run tests;
- start `gnodev`;
- execute local tools;
- use local `gnokey`;
- debug;
- deploy packages.

## 6.5 Operator

Unlocked by local node or validator configuration.

Additional capabilities:

- monitor processes;
- manage local services;
- inspect validator health;
- manage node lifecycle;
- receive operational alerts;
- inspect logs and resource usage.

Capabilities are additive. No user is forced to unlock later modes.

---

# 7. First-run experience

## 7.1 Launch state

Gnomputer opens directly into a curated live workspace.

Layout:

```text
┌─────────────────────────────────────────────────────────┐
│ Gnomputer   Network · Height · Search · Guest           │
├───────────────────────────────┬─────────────────────────┤
│                               │                         │
│        Live Realm             │        Source           │
│                               │                         │
├───────────────────────────────┴─────────────────────────┤
│ Recent activity · transactions · calls · deployments   │
└─────────────────────────────────────────────────────────┘
```

Opening text:

> **You are browsing the shared computer.**
> Open any program, user, function or transaction to follow it through the world.

No modal. No carousel. No wallet prompt.

## 7.2 First wow moment: Live Code

The initial realm is shown beside its source.

When a new transaction invokes an identifiable function:

- the activity entry appears;
- the function is linked;
- the corresponding source symbol receives a brief restrained highlight;
- clicking it opens the transaction Trail.

The user immediately sees that application, source and activity belong to the same system.

## 7.3 Second wow moment: Action becomes code

From a realm action:

```text
Human action
→ transaction intent
→ exact command
→ editable Run program
```

The transition should feel continuous.

The interface expands progressively rather than sending the user through unrelated screens.

## 7.4 Third wow moment: Fork the world

When the companion is available:

```text
On-chain realm
→ Fork locally
→ Start gnodev
→ Edit
→ Test
→ Preview
→ Compare
→ Deploy
→ Open live result
```

The entire flow remains connected to the originating object and Trail.

---

# 8. Universal object model

Every significant object is represented by an `EntityRef`.

```ts
export type EntityKind =
  | "network"
  | "realm"
  | "package"
  | "source-file"
  | "function"
  | "type"
  | "state-object"
  | "address"
  | "identity"
  | "account"
  | "balance"
  | "transaction"
  | "transaction-message"
  | "block"
  | "event"
  | "proposal"
  | "validator"
  | "local-workspace"
  | "local-file"
  | "process"
  | "trail";

export interface EntityRef {
  uri: string;
  kind: EntityKind;
  networkId: string;
  chainId?: string;

  packagePath?: string;
  objectId?: string;
  filePath?: string;
  functionName?: string;

  height?: number | "latest";
  lens?: LensId;

  query?: Record<string, string | number | boolean>;
  adapterVersion?: string;
}
```

## 8.1 Canonical URI scheme

```text
gno://betanet/realm/gno.land/r/gov/dao
gno://betanet/function/gno.land/r/gov/dao#Vote
gno://betanet/address/g1...
gno://betanet/tx/ABC123
gno://betanet/proposal/gno.land/r/gov/dao/12
gno://local/workspace/my-fork
gno://local/trail/investigate-proposal-12
```

Every object must also map to a shareable HTTP URL.

---

# 9. Universal lens model

All compatible entities expose a stable set of lenses.

```ts
export type LensId =
  | "experience"
  | "source"
  | "docs"
  | "state"
  | "history"
  | "actions"
  | "graph"
  | "raw"
  | "time";
```

## 9.1 Experience

The human-facing application or representation.

Examples:

- realm render;
- proposal page;
- identity card;
- validator dashboard;
- transaction interpretation.

## 9.2 Source

Relevant source files and symbols.

## 9.3 Docs

Package, type, function and protocol documentation.

## 9.4 State

Current or derived state.

## 9.5 History

Transactions, events, versions and changes.

## 9.6 Actions

Queries, calls, commands and permitted mutations.

## 9.7 Graph

Imports, references, callers, owners, dependencies and related objects.

## 9.8 Raw

RPC, GraphQL, JSON, command and protocol representations.

## 9.9 Time

Historical context where data sources support it.

Unavailable lenses must be represented honestly:

```text
Historical state is unavailable on this network.
Current state only.
Source history available; state history unavailable.
Reconstructed from indexed transactions.
```

---

# 10. Data provenance

Every external or cached value must carry provenance.

```ts
export interface DataEnvelope<T> {
  ref: EntityRef;
  data: T;

  source:
    | "rpc"
    | "indexer"
    | "gnoweb"
    | "wallet"
    | "companion"
    | "cache"
    | "derived";

  consistency:
    | "authoritative"
    | "indexed"
    | "derived"
    | "best-effort";

  networkId: string;
  chainId?: string;
  height?: number;

  fetchedAt: string;
  freshness:
    | "live"
    | "cached"
    | "stale"
    | "historical";

  schema: string;
  warnings?: DataWarning[];
}
```

Core rule:

> Use the indexer to discover. Use the chain to confirm.

The UI must never silently present derived data as authoritative.

---

# 11. Execution architecture

## 11.1 PWA first

The primary product is an installable web application.

It provides:

- zero-install guest access;
- realm and source browsing;
- transaction exploration;
- local persistence;
- wallet integration;
- transaction preparation;
- Run Studio;
- workspaces;
- Trails;
- offline shell;
- cached read-only data.

## 11.2 Companion second

A Go daemon provides privileged local capabilities.

Provisional binary:

```text
gnomputer-agent
```

It provides:

- filesystem workspaces;
- `gno`;
- `gnokey`;
- `gnodev`;
- `gnoland`;
- tx-indexer lifecycle;
- process management;
- logs;
- local signing;
- debugging;
- validator operations.

It is never required for public browsing.

## 11.3 Tauri third

Tauri packages the same shell for users who want:

- bundled companion;
- native protocol handlers;
- desktop notifications;
- native updates;
- richer filesystem interactions;
- local keychain integration.

Tauri must not create a separate application architecture.

---

# 12. High-level architecture

```text
┌───────────────────────────────────────────────────────────┐
│                     Gnomputer Shell                       │
│ Search · Workspaces · Trails · Lenses · Commands          │
├───────────────────────────────────────────────────────────┤
│                  Bundled Applications                     │
│ Realm · Tx · State · Users · Gov · Run · Build · Operate │
├───────────────────────────────────────────────────────────┤
│                    Gnomputer SDK                          │
│ Entities · Data · Intents · Wallet · Storage · Processes │
├───────────────────────────────────────────────────────────┤
│                      Adapters                             │
│ RPC · gnoweb · tx-indexer · GnoConnect · Companion       │
├───────────────────────────────────────────────────────────┤
│                    External Systems                       │
│ Gno networks · wallets · local tools · filesystem         │
└───────────────────────────────────────────────────────────┘
```

---

# 13. Internal SDK

Applications must not access external systems directly.

Forbidden from application packages:

- direct `fetch`;
- direct WebSocket construction;
- direct IndexedDB access;
- direct `localStorage`;
- direct wallet APIs;
- direct companion calls;
- direct filesystem access.

```ts
export interface GnomputerSDK {
  shell: ShellAPI;
  entities: EntityAPI;
  lenses: LensAPI;
  trails: TrailAPI;
  commands: CommandAPI;

  networks: NetworkAPI;
  query: QueryAPI;
  indexer: IndexerAPI;
  source: SourceAPI;
  state: StateAPI;
  identities: IdentityAPI;

  wallet: WalletAPI;
  intents: IntentAPI;
  transactions: TransactionAPI;

  workspaces: WorkspaceAPI;
  developer: DeveloperAPI;
  processes: ProcessAPI;

  storage: StorageAPI;
  permissions: PermissionAPI;
  notifications: NotificationAPI;
}
```

---

# 14. Shell and workspace model

## 14.1 Hybrid layout

Do not immediately implement a complete free-form desktop window manager.

Use:

- primary tabbed views;
- resizable split panes;
- floating inspectors;
- detachable views later;
- optional full-screen apps.

Supported view actions:

```text
Open
Open beside
Open below
Open in inspector
Replace current
Pin
Add to Trail
Add to workspace
Open in browser tab
```

## 14.2 Workspaces

A workspace stores:

- layout;
- network;
- open entities;
- active lenses;
- selected height;
- Trails;
- filters;
- watchlists;
- drafts;
- Run programs;
- local workspace references.

Default workspaces:

```text
Explore
Govern
Build
Operate
```

## 14.3 Trail versus workspace

A workspace is the current working environment.

A Trail is a semantic investigation or workflow inside or across workspaces.

---

# 15. Command system

Every meaningful operation should be exposed as a command.

```ts
export interface CommandDefinition {
  id: string;
  title: string;
  category: string;
  keywords?: string[];
  requiredCapabilities?: Capability[];
  when?: CommandPredicate;
  execute(context: CommandContext): Promise<void>;
}
```

Examples:

```text
Open realm
Inspect source
Inspect state
Follow transaction
Start Trail
Add to Trail
Convert action to Run
Fork locally
Start gnodev
Run tests
Deploy package
Connect wallet
Open validator logs
Switch network
```

## 15.1 Command palette

Keyboard shortcuts:

```text
Cmd/Ctrl+K           Global command palette
Cmd/Ctrl+P           Open object
Cmd/Ctrl+Shift+P     Search commands
Cmd/Ctrl+\           Split current view
Cmd/Ctrl+Enter       Run or submit current action
```

## 15.2 Text commands

Later versions may support:

```text
open r/gov/dao
inspect tx ABC123
trail start "proposal 12"
watch validator g1...
fork gno.land/r/demo/foo
run ./scripts/vote
network switch betanet
```

Natural language may resolve to commands later, but every resolved mutation must be previewed before execution.

---

# 16. Transaction Intent Protocol

No app, adapter or plugin signs directly.

Every mutation becomes an intent.

```ts
export type IntentKind =
  | "send"
  | "call"
  | "run"
  | "add-package"
  | "multi-message"
  | "sign"
  | "broadcast"
  | "fork-local"
  | "manage-process";

export interface TransactionIntent {
  id: string;
  kind: IntentKind;

  networkId: string;
  chainId?: string;

  origin: {
    appId: string;
    userAction: string;
    ref?: EntityRef;
    pluginId?: string;
  };

  target?: EntityRef;
  messages?: GnoMessage[];

  functionName?: string;
  args?: TypedArgument[];
  funds?: Coin[];

  gasPolicy?: GasPolicy;
  storagePolicy?: StoragePolicy;

  runSource?: RunBundle;
  packageBundle?: PackageBundle;

  safeguards: {
    requiresWallet: boolean;
    requiresCompanion: boolean;
    reviewLevel: "info" | "confirm" | "danger";
  };

  humanSummary: string;
  warnings?: IntentWarning[];

  preview?: {
    gnokeyArgs?: string[];
    rawTransaction?: unknown;
  };
}
```

## 16.1 Review flow

```text
Intent
→ validation
→ simulation when supported
→ estimate
→ signer selection
→ review
→ sign
→ broadcast
→ track
→ inspect result
```

## 16.2 Review requirements

Always display:

- network;
- chain ID;
- originating app;
- originating realm or plugin;
- signer;
- human-readable action;
- exact messages;
- function and arguments;
- funds;
- estimated gas;
- estimated storage impact;
- warnings;
- equivalent `gnokey` command;
- raw representation.

For Run:

- full source;
- imported packages;
- expected calls;
- script hash;
- funds and permissions.

---

# 17. Application catalog

## 17.1 Home

A live system dashboard, not a marketing page.

Shows:

- curated realms;
- active system realms;
- recent deployments;
- recent proposals;
- live transactions;
- watched entities;
- saved Trails;
- resumed workspaces;
- network health.

## 17.2 World Explorer

Browse:

- realms;
- packages;
- namespaces;
- authors;
- system realms;
- recently active programs;
- dependency graphs;
- recently deployed code.

## 17.3 Realm Browser

Lenses:

- Experience;
- Source;
- Docs;
- State;
- History;
- Graph;
- Actions;
- Raw.

Features:

- render realm;
- intercept Gno links;
- detect exported functions;
- generate action forms;
- expose equivalent commands;
- open native realm app when compatible;
- fork locally.

## 17.4 Source Explorer

Features:

- file tree;
- syntax highlighting;
- symbol outline;
- imports;
- dependencies;
- function references;
- source history;
- source-to-transaction links;
- source-to-state links;
- source-to-Run conversion;
- open in Builder.

Monaco must be lazy-loaded only for editing workflows.

## 17.5 Transaction Explorer

Features:

- live stream;
- GraphQL search;
- blocks;
- messages;
- events;
- execution results;
- signer;
- gas;
- storage;
- called functions;
- affected realms;
- related state;
- raw transaction;
- clone;
- convert to Run;
- start investigation Trail.

## 17.6 State Explorer

Progressive implementation levels:

### Level A — Public state

- Render;
- docs;
- functions;
- readonly queries;
- public metadata.

### Level B — Structured state

- typed object tree;
- lazy loading;
- raw values;
- search;
- table view;
- graph view.

### Level C — Derived state

- realm adapters;
- indexed reconstruction;
- transaction-linked changes;
- domain-specific views.

### Level D — VM-native inspection

- object identities;
- references;
- historical snapshots;
- mutation graph;
- transaction replay.

Levels must be capability-detected.

## 17.7 Account and Bank

Features:

- account identity;
- address;
- account number;
- sequence;
- balances;
- transactions;
- packages;
- governance;
- watch-only mode;
- send;
- batch drafts;
- storage deposits where available.

## 17.8 Users

Adapter-based native experience for identity realms such as `r/sys/users`.

Features:

- directory;
- address lookup;
- name lookup;
- profile card;
- packages;
- realms;
- balances;
- activity;
- governance;
- validator relationship.

```ts
export interface IdentityProvider {
  id: string;
  supports(network: NetworkConfig): Promise<boolean>;
  resolveAddress(address: string): Promise<IdentityRecord[]>;
  resolveName(name: string): Promise<IdentityRecord[]>;
  list(params: IdentityListParams): Promise<IdentityPage>;
}
```

## 17.9 GovDAO

Features:

- proposals;
- proposal details;
- author;
- status;
- voters;
- votes;
- timeline;
- relevant source;
- proposed execution;
- vote intent;
- execution intent;
- proposal Trail.

```ts
export interface GovernanceAdapter {
  listProposals(): Promise<Proposal[]>;
  getProposal(id: string): Promise<ProposalDetails>;
  listMembers(): Promise<Member[]>;
  getVotingPower(address: string): Promise<VotingPower>;
  buildVoteIntent(input: VoteInput): Promise<TransactionIntent>;
}
```

## 17.10 Validator Monitor

Features:

- validator set;
- voting power;
- status;
- missed blocks;
- proposer activity;
- changes;
- estimated uptime;
- local process association;
- governance links;
- alerts.

## 17.11 Network Monitor

Features:

- chain ID;
- endpoint health;
- RPC latency;
- indexer health;
- WebSocket status;
- latest block;
- block timing;
- validator set;
- persistence warnings;
- custom network creation.

## 17.12 Wallet and Gnokey

Wallet modes:

```text
External wallet
Local gnokey wallet
Watch-only account
```

External wallet is implemented first.

Local wallet operations occur in the companion.

Never expose mnemonic or private key material to the frontend.

## 17.13 Transaction Studio

Types:

- Send;
- Call;
- Run;
- AddPackage;
- multi-message;
- import raw;
- clone transaction.

All output is an intent.

## 17.14 Run Studio

Signature product feature.

Features:

- editor;
- multi-file programs;
- imports;
- templates;
- validation;
- signer;
- funds;
- gas;
- command preview;
- simulation;
- transaction tracking;
- script history;
- Trail integration.

Required conversions:

```text
Realm action → Run program
Transaction → Run program
Several transactions → composite Run program
Trail actions → Run program
Proposal execution → Run program
```

## 17.15 Builder

Features:

- local projects;
- fork from chain;
- source tree;
- editor;
- format;
- tests;
- filetests;
- local execution;
- `gnodev`;
- preview;
- compare;
- deploy;
- debugger;
- package graph.

## 17.16 Debugger

Initial:

- breakpoints;
- continue;
- step;
- stack;
- variables;
- console;
- logs.

Advanced:

- replay transaction;
- state before/after;
- gas by frame;
- mutation timeline;
- source mapping;
- cross-realm call graph.

## 17.17 Process Manager

Processes:

- `gnodev`;
- local `gnoland`;
- tx-indexer;
- proxies;
- development tasks;
- validator-related processes.

Actions:

- start;
- stop;
- restart;
- inspect;
- open logs;
- copy command;
- open associated workspace.

## 17.18 Terminal

Web mode:

- safe Gnomputer commands.

Companion mode:

- allowlisted Gno tool profiles;
- optional explicit Developer Mode shell.

No generic remote execution endpoint is permitted.

---

# 18. Realm adapters and native apps

Every realm works generically.

A native app is an enhancement, never a requirement.

```ts
export interface RealmAdapter {
  id: string;
  packagePath: string;
  adapterVersion: string;

  supports(context: RealmContext): Promise<boolean>;

  getMetadata?(context: RealmContext): Promise<RealmMetadata>;
  getViews?(context: RealmContext): Promise<LensDescriptor[]>;
  getActions?(context: RealmContext): Promise<ActionDescriptor[]>;
  mapState?(context: RealmContext): Promise<DomainState>;
}
```

Compatibility checks may use:

- package path;
- network;
- source fingerprint;
- expected exported functions;
- version metadata.

Incompatible adapters fall back to generic views.

---

# 19. Plugin system

Plugins are delayed until core product flows are stable.

## Stage 1

Bundled trusted applications.

## Stage 2

Declarative adapters.

## Stage 3

Sandboxed executable plugins.

Plugin rules:

- default deny;
- no direct wallet;
- no direct signing;
- no direct companion access;
- no direct network access;
- intents only;
- explicit capabilities;
- per-session or per-workspace grants;
- visible origin during review.

---

# 20. Companion security

## 20.1 Required guarantees

The companion must:

- bind to loopback by default;
- select a random port;
- require explicit pairing;
- use short-lived session credentials;
- support revocation;
- validate all inputs;
- expose capability-specific APIs;
- maintain a local audit log;
- redact secrets;
- prohibit generic shell execution by default.

## 20.2 Pairing

```text
Detect companion
→ Pair
→ one-time code
→ capability request
→ user approval
→ short-lived session
```

## 20.3 API areas

```text
/health
/version
/pairing
/capabilities
/keys
/sign
/workspaces
/files
/tools
/processes
/logs
/gnodev
/gnoland
/debug
```

## 20.4 Tool execution

Correct:

```ts
runGnoTests({
  workspaceId,
  packagePath,
  testFilter,
});
```

Forbidden:

```text
POST /exec
{"command":"anything"}
```

Raw shell is a separately enabled developer capability.

---

# 21. Capability model

```ts
export type Capability =
  | "network.read"
  | "network.manage"
  | "indexer.read"

  | "wallet.list"
  | "wallet.request-signature"
  | "wallet.manage-local"

  | "transaction.prepare"
  | "transaction.broadcast"

  | "workspace.read"
  | "workspace.write"

  | "filesystem.read"
  | "filesystem.write"

  | "process.list"
  | "process.start"
  | "process.stop"

  | "logs.read"

  | "developer.format"
  | "developer.test"
  | "developer.run"
  | "developer.debug"
  | "developer.deploy"

  | "terminal.profile.execute"
  | "terminal.shell.execute";
```

Capabilities must be:

- explicit;
- revocable;
- scoped;
- visible;
- auditable.

---

# 22. Storage architecture

## IndexedDB

Use for:

- networks;
- endpoint health;
- entity cache;
- workspaces;
- Trails;
- layouts;
- history;
- favorites;
- watchlists;
- identities;
- transactions;
- drafts;
- Run programs;
- permissions;
- plugin metadata;
- notifications.

## OPFS

Use for:

- browser-only source snapshots;
- large cached source bundles;
- local browser workspaces;
- replay artifacts;
- state snapshots;
- editor backups;
- export archives.

## Companion filesystem

```text
~/.gnomputer/
├── config.json
├── auth/
├── workspaces/
├── trails/
├── scripts/
├── snapshots/
├── plugins/
├── logs/
└── cache/
```

Existing `gnokey` stores remain in their native locations.

---

# 23. Network registry

```ts
export interface NetworkConfig {
  id: string;
  name: string;
  chainId: string;

  rpcUrl: string;
  websocketUrl?: string;
  gnowebUrl?: string;
  indexerGraphqlUrl?: string;
  indexerWebsocketUrl?: string;
  faucetUrl?: string;

  environment:
    | "mainnet"
    | "betanet"
    | "staging"
    | "testnet"
    | "local"
    | "custom";

  persistence:
    | "persistent"
    | "rolling"
    | "ephemeral"
    | "unknown";

  trust:
    | "official"
    | "community"
    | "local"
    | "custom";

  capabilities: NetworkCapability[];
  warnings?: NetworkWarning[];
}
```

Always display network context prominently during mutations.

---

# 24. Global search

Search:

- realms;
- packages;
- symbols;
- identities;
- addresses;
- transactions;
- blocks;
- proposals;
- validators;
- processes;
- workspaces;
- Trails;
- commands;
- settings.

Filters:

```text
type:realm
type:tx
network:betanet
realm:r/gov/dao
function:Vote
status:failed
from:g1...
height:1000..2000
trail:proposal-12
```

Search results must be keyboard navigable and grouped by entity type.

---

# 25. Time model

Do not promise universal historical state.

Expose explicit time capabilities:

```text
Current only
Historical metadata
Historical source
Indexed history
Reconstructed state
Local replay
Authoritative historical state
```

A selected height becomes workspace context and propagates to compatible lenses.

Unsupported views remain at current state with a clear warning.

---

# 26. Error experience

Every error should answer:

- what failed;
- whether anything was signed;
- whether anything was broadcast;
- where execution failed;
- why it may have failed;
- whether retry is safe;
- what investigative actions are available.

Example:

```text
Vote rejected

The selected signer is not eligible to vote on this proposal.

Failed in:
gno.land/r/gov/dao
MustVoteOnProposalSimple()
line 184

Nothing else was broadcast.

Open source
Inspect proposal state
Clone as Run program
Replay locally
Start investigation Trail
```

Failures should deepen understanding instead of terminating the experience.

---

# 27. Visual design

The design should be:

- technical;
- calm;
- dense where useful;
- readable;
- keyboard-first;
- visually alive without distraction.

Avoid:

- generic crypto dashboards;
- financial-chart aesthetics;
- toy OS skeuomorphism;
- excessive glass effects;
- noisy motion;
- decorative windows;
- fake retro terminals.

Use consistent entity motifs:

```text
Realm         portal
Package       module
Transaction   trail
Identity      seal
Proposal      document
Validator     machine
Run program   flow
Workspace     desk
Trail         path
```

---

# 28. Accessibility

Target WCAG 2.2 AA.

Requirements:

- full keyboard navigation;
- visible focus;
- semantic landmarks;
- correct ARIA tab, tree, dialog and splitter behavior;
- no drag-only operations;
- reduced-motion option;
- screen-reader labels;
- high contrast;
- focus restoration;
- resizable text;
- minimum pointer target sizing.

---

# 29. Privacy and telemetry

Telemetry is opt-in.

Never collect:

- keys;
- mnemonics;
- local file content;
- terminal history;
- unsigned drafts;
- companion credentials;
- private notes;
- private Trails.

Optional anonymous metrics:

- startup time;
- errors;
- unsupported schemas;
- feature usage;
- wallet-flow abandonment;
- adapter compatibility;
- search performance.

A local telemetry inspector must show what would be sent.

---

# 30. Monorepo structure

```text
gnomputer/
├── apps/
│   ├── web/
│   ├── desktop/
│   ├── companion/
│   ├── docs/
│   └── mock-server/
│
├── packages/
│   ├── app-sdk/
│   ├── core/
│   ├── entities/
│   ├── lenses/
│   ├── trails/
│   ├── shell/
│   ├── ui/
│   ├── theme/
│   ├── routing/
│   ├── commands/
│   ├── permissions/
│   ├── storage/
│   ├── networks/
│   ├── rpc/
│   ├── indexer/
│   ├── source/
│   ├── state/
│   ├── identities/
│   ├── transactions/
│   ├── wallets/
│   ├── developer/
│   ├── processes/
│   ├── plugins/
│   ├── testing/
│   └── apps/
│       ├── home/
│       ├── world-explorer/
│       ├── realm-browser/
│       ├── source-explorer/
│       ├── state-explorer/
│       ├── tx-explorer/
│       ├── block-explorer/
│       ├── account-explorer/
│       ├── bank/
│       ├── users/
│       ├── govdao/
│       ├── validators/
│       ├── network-monitor/
│       ├── wallet/
│       ├── transaction-studio/
│       ├── run-studio/
│       ├── builder/
│       ├── debugger/
│       ├── process-manager/
│       ├── terminal/
│       └── settings/
│
├── fixtures/
├── examples/
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── product/
│   ├── protocols/
│   ├── security/
│   ├── ux/
│   └── operations/
│
└── e2e/
```

---

# 31. Engineering rules

## TypeScript

- strict mode;
- no unvalidated external payloads;
- no `any` without documented justification;
- exhaustive discriminated unions;
- typed errors;
- apps consume SDK services only;
- no direct network or storage access.

## React

- business logic outside components;
- app-level error boundaries;
- lazy-loaded heavy applications;
- virtualized large lists;
- stable workspace restoration;
- accessible primitives.

## Go companion

- explicit request types;
- no shell interpolation;
- timeouts;
- cancellation;
- structured logs;
- argument validation;
- audited privileged operations;
- platform-specific code isolated.

## Documentation

Every major package requires:

- README;
- public API;
- examples;
- security notes;
- tests.

---

# 32. Required ADRs

Create:

```text
ADR-001-pwa-first-execution-model.md
ADR-002-entityref-and-lenses.md
ADR-003-trails-as-core-primitive.md
ADR-004-data-envelope-and-provenance.md
ADR-005-transaction-intent-protocol.md
ADR-006-companion-loopback-security.md
ADR-007-plugin-default-deny-capabilities.md
ADR-008-time-travel-capability-labels.md
ADR-009-identity-provider-adapters.md
ADR-010-workspace-layout-model.md
ADR-011-realm-adapter-compatibility.md
ADR-012-indexer-discovery-rpc-confirmation.md
```

---

# 33. Testing strategy

## Unit tests

- URI parsing;
- entity resolution;
- lens availability;
- Trail serialization;
- intent normalization;
- provenance;
- permission evaluation;
- adapter compatibility;
- network detection.

## Contract tests

Golden fixtures for:

- RPC;
- structured VM queries;
- gnoweb;
- tx-indexer GraphQL;
- wallet bridge;
- companion API.

## Integration tests

- realm → source;
- transaction → function;
- user resolution;
- proposal interpretation;
- validator changes;
- intent review;
- action → Run;
- Trail recording;
- workspace restoration.

## End-to-end tests

Required Playwright flows:

```text
guest_boot_shared_computer.spec.ts
realm_source_live_activity.spec.ts
transaction_to_source_trail.spec.ts
users_registry_lookup.spec.ts
proposal_vote_intent_review.spec.ts
action_to_run_program.spec.ts
fork_realm_to_local_workspace.spec.ts
validator_change_to_proposal.spec.ts
workspace_and_trail_restore.spec.ts
```

---

# 34. Implementation roadmap

## Phase 0 — Foundations

Build:

- monorepo;
- CI;
- UI primitives;
- `EntityRef`;
- lenses;
- `DataEnvelope`;
- network registry;
- SDK boundaries;
- fixtures;
- ADRs.

Acceptance:

- test app opens a typed entity through the SDK;
- external data is validated;
- workspace state persists.

## Phase 1 — Boot experience

Build:

- shell;
- curated guest workspace;
- network selector;
- Home;
- World Explorer;
- Realm Browser;
- Source Explorer;
- first live indicators.

Acceptance:

- user sees realm, source and activity without onboarding;
- no wallet prompt;
- first meaningful content in under two seconds on warm load.

## Phase 2 — Transactions and Trails

Build:

- tx-indexer adapter;
- Transaction Explorer;
- Block Explorer;
- Account Explorer;
- cross-object links;
- Trail engine;
- transaction-to-source navigation.

Acceptance:

- user can follow transaction → function → source → account;
- Trail persists after reload.

## Phase 3 — System apps

Build:

- Users;
- identity providers;
- Bank read-only;
- GovDAO;
- governance adapters;
- Validator Monitor;
- Network Monitor.

Acceptance:

- system realms feel native;
- incompatible adapter safely falls back.

## Phase 4 — Intent engine and external wallet

Build:

- wallet bridge;
- transaction intents;
- review screen;
- Send;
- Call;
- transaction tracking.

Acceptance:

- no mutation bypasses review;
- wallet requested only when required.

## Phase 5 — Run Studio

Build:

- editor;
- templates;
- action-to-Run;
- transaction-to-Run;
- Trail-to-Run;
- command preview;
- signing;
- tracking.

Acceptance:

- vote action becomes editable Run source and a signed transaction.

## Phase 6 — PWA hardening

Build:

- service worker;
- offline shell;
- cache policy;
- installability;
- storage management;
- accessibility audit;
- performance audit.

## Phase 7 — Companion

Build:

- pairing;
- capabilities;
- authentication;
- health;
- allowlisted tools;
- workspaces;
- processes;
- logs.

Acceptance:

- optional installation;
- no private key data enters frontend;
- arbitrary shell unavailable by default.

## Phase 8 — Gnokey

Build:

- local key metadata;
- local signing;
- create/import operations;
- lock state;
- watch-only integration;
- permission history.

## Phase 9 — Builder

Build:

- fork realm;
- local workspace;
- tests;
- filetests;
- `gnodev`;
- preview;
- compare;
- deploy;
- open live result.

## Phase 10 — Process and operator tools

Build:

- Process Manager;
- local node lifecycle;
- indexer lifecycle;
- validator process association;
- alerts;
- logs.

## Phase 11 — State Explorer

Build:

- public queries;
- structured state;
- adapter-derived state;
- snapshots;
- diffs;
- transaction links.

## Phase 12 — Debugger

Build:

- local debugger;
- breakpoints;
- stack;
- variables;
- local replay;
- mutation timeline.

## Phase 13 — Tauri

Build:

- native packaging;
- companion sidecar;
- protocol handler;
- desktop notifications;
- updates.

## Phase 14 — Plugins

Build:

- declarative adapters;
- sandbox;
- permission grants;
- registry;
- compatibility validation.

## Phase 15 — Advanced history

Build where supported:

- source history;
- historical state;
- workspace-wide height selection;
- transaction replay;
- authoritative capability labels.

---

# 35. Exact vertical-slice order

Do not build horizontally for months.

## Slice 1

```text
Boot experience
+ Realm Browser
+ Source Explorer
+ persistent workspace
```

## Slice 2

```text
Transaction list
+ transaction detail
+ source correlation
+ Trail recording
```

## Slice 3

```text
Users
+ identity page
+ balances
+ activity
```

## Slice 4

```text
GovDAO
+ proposal
+ author
+ creation transaction
+ source
```

## Slice 5

```text
External wallet
+ Call intent
+ review
+ sign
+ receipt
```

## Slice 6

```text
Action
+ command preview
+ Run conversion
+ execution
```

## Slice 7

```text
Companion
+ pairing
+ gnokey list
+ local signing
```

## Slice 8

```text
Fork realm
+ local workspace
+ tests
+ gnodev preview
```

## Slice 9

```text
Deploy
+ inspect result
+ compare source
+ complete Trail
```

Each slice must end in a polished demonstrable flow.

---

# 36. MVP

The MVP includes:

- PWA;
- zero-friction guest mode;
- Home;
- World Explorer;
- Realm Browser;
- Source Explorer;
- Transaction Explorer;
- Block Explorer;
- Account Explorer;
- Users;
- Bank read-only;
- GovDAO;
- Validator Monitor read-only;
- Network Monitor;
- global search;
- workspaces;
- Trails;
- external wallet;
- Send and Call intents;
- review screen;
- minimal Run Studio;
- favorites;
- watchlists;
- local persistence.

The MVP excludes:

- companion;
- local gnokey management;
- Builder;
- process operations;
- debugger;
- executable plugins;
- VM-native object inspection;
- Tauri.

---

# 37. MVP acceptance demo

The product is not MVP-complete until this demo works without manual intervention:

1. Open Gnomputer without a wallet.
2. See a realm, its source and live activity.
3. Start a Trail automatically.
4. Search for GovDAO.
5. Open a proposal.
6. Open its author.
7. Inspect the author's identity and balances.
8. Open the proposal creation transaction.
9. Open the called source function.
10. Return through the Trail.
11. Click Vote.
12. Connect an external wallet.
13. Review the transaction intent.
14. Inspect the equivalent `gnokey` command.
15. Sign and broadcast.
16. Follow the transaction live.
17. Add the resulting transaction to the Trail.
18. Convert the vote into a Run program.
19. Edit the program.
20. Save both program and Trail locally.
21. Reload Gnomputer.
22. Resume the exact investigation.

---

# 38. Performance targets

```text
Warm shell render                    < 1 second
Initial meaningful live view         < 2 seconds
Command palette opening              < 100 ms
Cached object navigation             < 300 ms
Local search feedback                < 100 ms
Interactive split resizing           60 FPS
```

Heavy applications such as Monaco, Builder and Debugger must be lazy-loaded.

---

# 39. Key product metrics

Primary metric:

> Percentage of first-time users who open a realm, its source and a related transaction within 60 seconds.

Other metrics:

- time to first object;
- time to first Trail;
- realm-to-source conversion;
- transaction-to-source conversion;
- wallet prompt abandonment;
- intent review completion;
- action-to-Run conversion;
- Trail resumption;
- saved workspace rate;
- companion installation;
- fork-to-preview completion;
- deploy completion;
- crash-free sessions.

---

# 40. Hard constraints for the implementation agent

1. Never require a wallet for read-only features.
2. Never let apps call wallets directly.
3. Never let plugins sign.
4. Never let apps bypass the SDK.
5. Never present indexed or derived data as authoritative.
6. Never hide network or chain context during mutations.
7. Never build a decorative desktop metaphor without compositional value.
8. Never block releases on perfect generic state inspection.
9. Never expose arbitrary local shell execution by default.
10. Never hardcode mutable realm APIs without adapters.
11. Never build plugins before core flows work.
12. Never finish a milestone without a demonstrable vertical user flow.
13. Always make raw commands and data available behind human-readable views.
14. Always preserve the path from action to code.
15. Always keep Gnomputer useful in guest mode.

---

# 41. Initial builder task

```text
Build the first production-quality vertical slice of Gnomputer.

Product:
Gnomputer is the workstation for the Gno shared computer.
Tagline: "Boot the shared computer."

Goal:
A first-time visitor must understand within 60 seconds that Gno programs,
source code, users and activity belong to one live inspectable world.

Stack:
- TypeScript
- React
- Vite
- TanStack Router
- TanStack Query
- Zustand
- Dexie
- Zod
- Vitest
- Playwright
- pnpm workspaces
- Turborepo

Implement:

1. Monorepo foundations.

2. EntityRef and canonical gno:// URIs.

3. Lens system:
   - experience
   - source
   - docs
   - state
   - history
   - actions
   - graph
   - raw
   - time

4. DataEnvelope with provenance and freshness.

5. Internal SDK boundaries.

6. Shell:
   - top bar
   - network selector
   - block/activity indicator
   - global search
   - guest identity
   - command palette
   - workspaces
   - split panes
   - persistent layout
   - history and favorites

7. First-run workspace:
   - live realm render
   - source beside it
   - recent activity below
   - no wallet prompt
   - copy: "You are browsing the shared computer."

8. Realm Browser:
   - render
   - Gno link interception
   - package metadata
   - source opening
   - favorites
   - explicit unavailable lens states

9. Source Explorer:
   - file tree
   - syntax highlighting
   - symbol navigation
   - import navigation
   - source permalink

10. Trail v1:
    - automatically record opened entities
    - show compact breadcrumb path
    - rename Trail
    - persist Trail
    - restore Trail after reload

11. Network registry:
    - default public network
    - custom networks
    - RPC
    - gnoweb
    - optional tx-indexer
    - endpoint health
    - visible warnings

12. Quality:
    - keyboard navigation
    - accessibility
    - loading states
    - empty states
    - offline states
    - error states
    - realistic fixtures
    - unit tests
    - Playwright tests
    - architecture and security documentation
    - required ADRs

Do not implement:
- wallet
- signing
- Run Studio
- Monaco
- companion
- local filesystem
- Builder
- Process Manager
- plugins
- Tauri
- generic state inspection

Acceptance demo:

1. Open with no wallet.
2. Immediately see a live realm, source and activity.
3. Open another realm or imported package.
4. Observe the Trail update.
5. Open source beside the realm.
6. Switch networks.
7. Reload.
8. Confirm workspace and Trail restoration.

The result must feel like the first usable version of a real product,
not an architectural prototype.
```

The most meaningful change from the previous specification is **Trails**: they turn Gnomputer from a collection of excellent explorers and tools into a coherent product with its own recognizable primitive.
