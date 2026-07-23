export interface ParsedImport {
  path: string;
  alias?: string;
}

const IMPORT_BLOCK_RE = /^import\s*\(([\s\S]*?)^\)/m;
const IMPORT_SINGLE_RE = /^import\s+(?:(\w+)\s+)?"([^"]+)"/m;
const IMPORT_LINE_RE = /^\s*(?:(\w+)\s+)?"([^"]+)"\s*$/;

/** Parses a Gno/Go-style import block (grouped or single-line). Only the
 * textual list of imported paths — resolving which ones are real on-chain
 * gno.land packages versus stdlibs is the caller's job (see isChainPackage). */
export function parseImports(source: string): ParsedImport[] {
  const blockMatch = IMPORT_BLOCK_RE.exec(source);
  if (blockMatch) {
    const imports: ParsedImport[] = [];
    for (const line of blockMatch[1]!.split("\n")) {
      const lineMatch = IMPORT_LINE_RE.exec(line);
      if (!lineMatch) continue;
      imports.push({ path: lineMatch[2]!, alias: lineMatch[1] });
    }
    return imports;
  }
  const single = IMPORT_SINGLE_RE.exec(source);
  if (single) return [{ path: single[2]!, alias: single[1] }];
  return [];
}

/** Gno only resolves imports on-chain for its own packages/realms — every
 * other import (std, errors, strings, chain/runtime/...) is a stdlib the
 * Realm Browser has no page for. */
export function isChainPackage(path: string): boolean {
  return path.startsWith("gno.land/p/") || path.startsWith("gno.land/r/");
}

export type SymbolKind = "func" | "type";

export interface ExportedSymbol {
  kind: SymbolKind;
  name: string;
  signature: string;
  doc: string[];
  /** A Gno convention, not a language keyword: a realm-mutating entrypoint
   * takes an unnamed/named `realm` as its first parameter (e.g. `_ realm`,
   * `cur realm`). Functions without one are plain queries. */
  isRealmAction: boolean;
  file: string;
}

const FUNC_DECL_RE = /^func\s+([A-Z]\w*)\s*(\([^)]*\)[^{]*)\{/;
const TYPE_DECL_RE = /^type\s+([A-Z]\w*)\s+(\S[^{]*)/;
const REALM_FIRST_PARAM_RE = /^\(\s*(?:\w+\s+)?realm\b/;

function collectDocComment(lines: string[], declLineIndex: number): string[] {
  const doc: string[] = [];
  let i = declLineIndex - 1;
  while (i >= 0) {
    const line = lines[i]!.trim();
    if (!line.startsWith("//")) break;
    doc.unshift(line.replace(/^\/\/\s?/, ""));
    i--;
  }
  return doc;
}

/** Extracts exported (capitalized) top-level func and type declarations from
 * one .gno file's source, with any doc comment immediately preceding them —
 * a lightweight godoc-style pass, not a full Go parser. Nested/unexported
 * declarations and const/var blocks are deliberately out of scope. */
export function parseExportedSymbols(file: string, source: string): ExportedSymbol[] {
  const lines = source.split("\n");
  const symbols: ExportedSymbol[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith(" ") || line.startsWith("\t")) continue;

    const funcMatch = FUNC_DECL_RE.exec(line);
    if (funcMatch) {
      const [, name, paramsAndReturn] = funcMatch;
      symbols.push({
        kind: "func",
        name: name!,
        signature: `func ${name}${paramsAndReturn!.trim()}`.trim(),
        doc: collectDocComment(lines, i),
        isRealmAction: REALM_FIRST_PARAM_RE.test(paramsAndReturn!.trim()),
        file,
      });
      continue;
    }

    const typeMatch = TYPE_DECL_RE.exec(line);
    if (typeMatch) {
      const [, name, rest] = typeMatch;
      symbols.push({
        kind: "type",
        name: name!,
        signature: `type ${name} ${rest!.replace(/\{$/, "").trim()}`.trim(),
        doc: collectDocComment(lines, i),
        isRealmAction: false,
        file,
      });
    }
  }

  return symbols;
}
