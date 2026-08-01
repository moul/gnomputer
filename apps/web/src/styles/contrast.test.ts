import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Relative to the package root, not to this file: the jsdom environment
// gives import.meta.url an http: URL, which fileURLToPath rejects.
const css = readFileSync(resolve(process.cwd(), "src/styles/theme.css"), "utf8");

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

interface Theme {
  name: string;
  tokens: Record<string, string>;
}

function parseThemes(): Theme[] {
  const themes: Theme[] = [];
  const blocks = css.matchAll(/:root\[data-theme="([\w-]+)"\]\s*\{([\s\S]*?)\n\}/g);
  for (const [, name, body] of blocks) {
    const tokens: Record<string, string> = {};
    for (const [, key, value] of body!.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)) {
      tokens[key!] = value!.toLowerCase();
    }
    themes.push({ name: name!, tokens });
  }
  return themes;
}

const themes = parseThemes();

// Every window titlebar paints its title in var(--accent-<accent>) at 12px
// bold on --bg-inset, and any app may be given any accent, so all of them
// have to clear the bar. --text-faint is used for secondary text throughout,
// on both surfaces.
const FOREGROUNDS = [
  "accent",
  "accent-cyan",
  "accent-amber",
  "accent-magenta",
  "accent-green",
  "accent-blue",
  "accent-red",
  "text-dim",
  "text-faint",
];
const SURFACES = ["bg", "bg-inset", "bg-elevated"];

/** WCAG AA for text below 18.66px bold / 24px regular — which is all of it
 * here; the shell's body text is 12–13px. */
const AA_SMALL_TEXT = 4.5;

describe("theme contrast", () => {
  it("finds every theme in theme.css", () => {
    // Guards the regexes above: if the file's shape changes and parsing
    // silently returns nothing, the rest of this suite would vacuously pass.
    expect(themes.map((t) => t.name).sort()).toEqual([
      "ascii-cypherpunk",
      "ascii-light",
      "modern-dark",
      "modern-light",
      "modern-minimal",
    ]);
  });

  for (const theme of themes) {
    for (const fg of FOREGROUNDS) {
      it(`${theme.name}: --${fg} is readable on every surface`, () => {
        const foreground = theme.tokens[fg];
        expect(foreground, `--${fg} missing from ${theme.name}`).toBeDefined();

        const failures = SURFACES.filter((s) => theme.tokens[s]).flatMap((surface) => {
          const ratio = contrastRatio(foreground!, theme.tokens[surface]!);
          return ratio < AA_SMALL_TEXT
            ? [`--${fg} ${foreground} on --${surface} ${theme.tokens[surface]} = ${ratio.toFixed(2)}:1`]
            : [];
        });

        expect(failures, `below ${AA_SMALL_TEXT}:1`).toEqual([]);
      });
    }
  }
});
