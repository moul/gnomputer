import { lazy, Suspense, type ComponentProps } from "react";
import type { Markdown as MarkdownImpl } from "./markdown";

// react-markdown + remark-gfm (+ their unified/mdast dependency tree) add
// real bundle weight, same reasoning as code-editor-lazy.tsx — not worth it
// in the initial chunk for a session that never opens Resources. Every
// consumer imports this wrapper instead of markdown.tsx directly.
const LazyMarkdown = lazy(() => import("./markdown").then((m) => ({ default: m.Markdown })));

export function Markdown(props: ComponentProps<typeof MarkdownImpl>) {
  return (
    <Suspense
      fallback={
        <p className="state-line" aria-busy="true">
          Loading…
        </p>
      }
    >
      <LazyMarkdown {...props} />
    </Suspense>
  );
}
