// gnoweb URL conventions confirmed live: a realm's page lives at the package
// path with the domain segment stripped (gno.land/r/sys/users ->
// /r/sys/users), and a colon suffix selects a sub-render path (used for
// pagination etc, e.g. /r/gov/dao:49). A per-address profile lives at
// /u/<address> (confirmed via curl — 200, not gnoweb's generic error page).
// gnoweb has no confirmed block-detail route, so that's intentionally not
// covered here — Block Explorer instead links out to a network's
// `explorerUrl` (e.g. mygnoscan) when one is configured.

export function gnowebRealmUrl(gnowebUrl: string, packagePath: string, renderPath?: string): string {
  const pathAfterDomain = packagePath.replace(/^[^/]+\//, "");
  const suffix = renderPath ? `:${renderPath}` : "";
  return `${gnowebUrl}/${pathAfterDomain}${suffix}`;
}

export function gnowebAddressUrl(gnowebUrl: string, address: string): string {
  return `${gnowebUrl}/u/${address}`;
}

// GnoConnect's "TxLink" convention (docs.gno.land/resources/gnoconnect) —
// $help selects the Actions tab's function-call form, &func=<Name> jumps
// straight to that function (confirmed live: the page's own function list
// narrows to just the one named), and any further &<param>=<value> pairs
// pre-fill that function's inputs by their real Gno parameter name (NOT
// positional arg1/arg2 — confirmed live: arg1= is silently ignored, but a
// param named after the function's actual argument, e.g. &addr=g1..., does
// populate it, verified by reading the resulting gnokey command's -args).
export function gnowebTxLink(
  gnowebUrl: string,
  packagePath: string,
  func: string,
  args: Record<string, string> = {},
): string {
  const pathAfterDomain = packagePath.replace(/^[^/]+\//, "");
  const params = new URLSearchParams({ func, ...args });
  return `${gnowebUrl}/${pathAfterDomain}$help&${params.toString()}`;
}

// mygnoscan's address-page convention — confirmed live against the deployed
// topaz instance (network-config.ts's explorerUrl).
export function mygnoscanAddressUrl(explorerUrl: string, address: string): string {
  return `${explorerUrl}/address/${address}`;
}
