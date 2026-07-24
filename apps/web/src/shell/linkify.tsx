import { Fragment } from "react";
import { createEntityPattern, type EntityKind } from "./entity-patterns";
import { openEntityMatch } from "./open-ref";

/** Renders `text` with any embedded entity references turned into clickable spans. */
export function Linkified({ text }: { text: string }) {
  const parts: (string | { kind: EntityKind; text: string })[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(createEntityPattern())) {
    const kind = Object.entries(match.groups ?? {}).find(([, v]) => v !== undefined)?.[0] as
      | EntityKind
      | undefined;
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
            onClick={(e) => openEntityMatch(part.kind, part.text, { x: e.clientX, y: e.clientY })}
          >
            {part.text}
          </button>
        )
      )}
    </>
  );
}
