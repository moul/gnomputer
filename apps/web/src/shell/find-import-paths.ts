export interface ImportPathMatch {
  path: string;
  from: number;
  to: number;
}

// Only matches quoted import paths inside an actual import statement/block
// (not just any string literal in the file that happens to look like a
// package path) — scans `import (...)` blocks and single-line
// `import "..."` statements separately, since Go/Gno source uses both
// forms. r/ and p/ both need covering: r/ realms and p/ library packages
// are both common import targets.
const IMPORT_BLOCK_RE = /import\s*\(([\s\S]*?)\)|import\s+"[^"]+"/g;
const IMPORT_PATH_RE = /"((?:[a-z0-9][a-z0-9._-]*\/)?(?:r|p)\/[a-zA-Z0-9_./-]+)"/g;

/** Finds every real import path in a Go/Gno source file, with the exact
 * character offsets of the path itself (excluding the surrounding quotes),
 * in document order — used to make each one a clickable link. */
export function findImportPaths(doc: string): ImportPathMatch[] {
  const matches: ImportPathMatch[] = [];
  for (const blockMatch of doc.matchAll(IMPORT_BLOCK_RE)) {
    const blockText = blockMatch[0];
    const blockStart = blockMatch.index ?? 0;
    IMPORT_PATH_RE.lastIndex = 0;
    for (const pathMatch of blockText.matchAll(IMPORT_PATH_RE)) {
      const path = pathMatch[1]!;
      const from = blockStart + (pathMatch.index ?? 0) + 1; // +1 skips the opening quote
      matches.push({ path, from, to: from + path.length });
    }
  }
  return matches;
}
