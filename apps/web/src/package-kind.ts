export type PackageKind = "realm" | "library" | "other";

/** Gno splits deployed code into two kinds by the segment right after the
 * domain: `/r/` is a realm (stateful, callable, has a Render()), `/p/` is a
 * pure package — a library realms import.
 *
 * Matched on that segment specifically, not as a substring: a realm may
 * perfectly well be called `gno.land/r/demo/p/something`, and
 * `packagePath.includes("/p/")` would call that a library. */
export function packageKind(packagePath: string): PackageKind {
  const segment = packagePath.split("/")[1];
  if (segment === "r") return "realm";
  if (segment === "p") return "library";
  return "other";
}
