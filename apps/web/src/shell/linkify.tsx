import { Fragment } from "react";
import { router } from "../routes/root";
import { openRef } from "./open-ref";

// Recognizes the entity references the spec calls out as universally
// clickable wherever they appear in prose: g1... addresses, @usernames,
// #block-numbers, and [domain/]r/foo/bar realm paths. Named groups let a
// single left-to-right scan know which kind matched without re-testing.
const ENTITY_PATTERN = new RegExp(
  [
    "(?<address>\\bg1[a-z0-9]{25,50}\\b)",
    "(?<username>@[a-zA-Z0-9_]+\\b)",
    "(?<block>#\\d+\\b)",
    "(?<realm>\\b(?:[a-z0-9][a-z0-9.-]*/)?r/[a-z0-9_]+(?:/[a-z0-9_]+)*\\b)",
  ].join("|"),
  "g"
);

function openUsername(handle: string) {
  // r/sys/users doesn't expose a confirmed per-user render path, so the best
  // honest click-through today is the users realm itself rather than
  // guessing a URL that might 404.
  void handle;
  void router.navigate({ to: "/", search: { pkg: "gno.land/r/sys/users" } });
}

function openMatch(kind: string, text: string) {
  switch (kind) {
    case "address":
      openRef(`gno://_/address/${text}`);
      return;
    case "block":
      openRef(`gno://_/block/${text.slice(1)}`);
      return;
    case "realm": {
      const packagePath = text.startsWith("r/") ? `gno.land/${text}` : text;
      openRef(`gno://_/realm/${packagePath}`);
      return;
    }
    case "username":
      openUsername(text.slice(1));
      return;
  }
}

/** Renders `text` with any embedded entity references turned into clickable spans. */
export function Linkified({ text }: { text: string }) {
  const parts: (string | { kind: string; text: string })[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(ENTITY_PATTERN)) {
    const kind = Object.entries(match.groups ?? {}).find(([, v]) => v !== undefined)?.[0];
    if (!kind || match.index === undefined) continue;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push({ kind, text: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  if (parts.length <= 1 && typeof parts[0] === "string") return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <button
            key={i}
            type="button"
            className="entity-link"
            data-kind={part.kind}
            onClick={() => openMatch(part.kind, part.text)}
          >
            {part.text}
          </button>
        )
      )}
    </>
  );
}
