// react-markdown renders a raw HTML block (a GitHub README's centered
// banner image, a badge wrapped in a <div>) as literal, escaped tag text
// rather than real markup — it has no built-in "html" node renderer, and
// this app deliberately doesn't add rehype-raw (that would mean trusting
// and executing arbitrary HTML fetched from GitHub). Dropping whole blocks
// that are themselves HTML reads far better than showing the tags as text.
export function stripHtmlBlocks(markdown: string): string {
  return markdown
    .split(/\n{2,}/)
    .filter((block) => !/^\s*<[a-z][a-z0-9-]*[\s/>]/i.test(block))
    .join("\n\n");
}
