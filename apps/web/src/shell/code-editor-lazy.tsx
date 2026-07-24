import { lazy, Suspense, type ComponentProps } from "react";
import type { CodeEditor as CodeEditorImpl } from "./code-editor";

// CodeMirror + the Go language grammar add real bundle weight (~450KB
// gzipped) — not worth it in the initial chunk for a session that never
// opens Source or the Editor app. Every consumer imports this wrapper
// instead of code-editor.tsx directly.
const LazyCodeEditor = lazy(() => import("./code-editor").then((m) => ({ default: m.CodeEditor })));

export function CodeEditor(props: ComponentProps<typeof CodeEditorImpl>) {
  return (
    <Suspense
      fallback={
        <p className="state-line" aria-busy="true">
          Loading editor…
        </p>
      }
    >
      <LazyCodeEditor {...props} />
    </Suspense>
  );
}
