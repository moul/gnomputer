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
