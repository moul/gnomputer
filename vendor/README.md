# vendor/

One prebuilt tarball, here temporarily.

## `gno-js-client-2.0.3-pr251-2dcfc98.tgz`

`@gnolang/gno-js-client` built from
[gnolang/gno-js-client#251](https://github.com/gnolang/gno-js-client/pull/251)
at commit `2dcfc98dd61d56482ffccf34d85e8adaea1894c4`, before that PR is
merged and released.

That PR makes the client surface the node's real ABCI error — typed
`NoRenderDeclError`, `InvalidPkgPathError` and friends — instead of a
generic "ABCI response is not initialized" for every VM failure. Without
it, adopting the client would have replaced precise errors with one
useless string and broken the realm browser's no-Render detection (#91).

## Why a tarball and not a git dependency

`github:gnolang/gno-js-client#<sha>` is the obvious way to do this and it
does not work here.

pnpm builds a git dependency after cloning it, and that build is the
problem. It needs pnpm 10 (upstream's `pnpm-workspace.yaml` uses pnpm 10
syntax that pnpm 9 rejects outright), and even on pnpm 10 it succeeded
locally and then failed in CI with a rolldown/oxc-runtime interop error
inside upstream's own bundler. Building someone else's package in an
environment they never tested is not a dependency, it's a liability.

A prebuilt tarball has none of that: no build step, no toolchain upgrade,
byte-identical on every machine, and it works on the pnpm we already use.

## Replacing it

When #251 is released:

1. `pnpm --filter @gnomputer/rpc add @gnolang/gno-js-client@<version>`
2. delete this directory
3. drop the note in CONTRIBUTING.md

Nothing else should need to change — the imports are the package's normal
public API.

## Regenerating it

```bash
git clone -b fix/abci-error-passthrough https://github.com/gnolang/gno-js-client
cd gno-js-client && git checkout 2dcfc98dd61d56482ffccf34d85e8adaea1894c4
npx pnpm@10.33.0 install && npx pnpm@10.33.0 pack
```

pnpm 10 is needed to *build* it; nothing in this repo needs pnpm 10 to
*consume* the result.
