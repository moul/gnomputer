export interface FavoriteMatch {
  packagePath: string;
  label: string;
}

/** Favorites matching a palette query, best first.
 *
 * Ranked separately from apps and realm suggestions because a favorite is
 * something you *chose*: an exact path match beats a prefix, a prefix beats
 * a substring, and a hit anywhere in the path beats one in the label —
 * people type paths here, and a label like "GovDAO" should not outrank the
 * path you actually starred.
 *
 * Matching is against the path AND the label so both "gov/dao" and "GovDAO"
 * find the same entry. */
export function matchFavorites(
  query: string,
  favorites: FavoriteMatch[],
  limit = 5
): FavoriteMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];

  const scored: { favorite: FavoriteMatch; rank: number }[] = [];
  for (const favorite of favorites) {
    const path = favorite.packagePath.toLowerCase();
    const label = favorite.label.toLowerCase();
    if (path === needle) scored.push({ favorite, rank: 0 });
    else if (path.startsWith(needle)) scored.push({ favorite, rank: 1 });
    else if (path.includes(needle)) scored.push({ favorite, rank: 2 });
    else if (label.startsWith(needle)) scored.push({ favorite, rank: 3 });
    else if (label.includes(needle)) scored.push({ favorite, rank: 4 });
  }

  return scored
    .sort((a, b) => a.rank - b.rank || a.favorite.packagePath.localeCompare(b.favorite.packagePath))
    .slice(0, limit)
    .map((s) => s.favorite);
}
