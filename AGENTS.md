# Working on Gnomputer as an agent

Read [CONTRIBUTING.md](CONTRIBUTING.md) first — layout, decisions, test
commands and the working habits all live there. This file is the part that is
easy to skip when you are fast and confident, which is most of the time.

## Probe first

**Find bugs by driving the app, not by reading it.** This is the default, not a
last resort after the diff looks clean.

It is what actually works here. The full product audit (#87) swept seven
dimensions and found less than an afternoon of breaking things did. Every
serious bug in the network-switching work was found by using the app: a shared
link opening the recipient's last-used realm instead of the linked one, a realm
opened from a link never reaching storage, the desktop remounting on every cold
load and doubling the first fetch, the switch overlay never appearing in
production. None of them showed up in a diff, and the suite was green for all
of them.

Reading finds what you already thought of. Probing finds the rest.

Things worth doing to it, none of which need permission:

- Point it at an endpoint that never answers, or answers with HTML.
- Open a realm that does not exist, and a package with no `Render()`.
- Switch network with windows open, mid-load, and twice quickly.
- Reload with storage already populated — the state every returning visitor is
  in, and the one a fresh test profile never reproduces.
- Open a link someone else would open: a shared URL, on a profile that has
  already been used.
- Clear storage, or deny it entirely, and see what claims to have worked.

`apps/mock-server` answers designated paths with real VM errors, so failure
paths are reachable offline. Add fixtures there rather than waiting on a chain
to misbehave.

## Say what you actually verified

Distinguish these, every time, in the PR and to whoever asked:

- ran the suite
- drove it in a browser locally
- checked the deployed site

They are not the same and they catch different things. A service worker serves
the previous build until it updates, so "deployed" and "what I am looking at"
routinely differ — hard-reload before concluding anything about production.

If a regression guard passes with the fix reverted, it guards nothing. Revert,
watch it fail, put it back. If a race will not reproduce in the test
environment, say the guard is coverage rather than protection instead of
letting green imply otherwise.

## Don't quietly narrow the job

If part of a request is awkward, do the rest and name what you left and why.
Scoping work down is the maintainer's call. Per-network state shipped once
covering only realm tabs while the windows kept the previous chain's contents —
the gap was stated, but it should have been the question before the work, not a
footnote after it.

## Two things that are easy to get wrong here

**PRs are squash-merged.** A branch cut from another branch that has already
been squashed will conflict against `main` on content that is genuinely already
there. Rebase onto `main` and cherry-pick your own commits rather than fighting
the merge.

**The bundle budget is measured on CI, not locally.** macOS gzips about 2KB
smaller than the runner, so a local build passing means very little when the
margin is thin. Read the number out of the `build` job.
