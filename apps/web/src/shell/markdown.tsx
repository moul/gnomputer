import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeEditor } from "./code-editor-lazy";
import { stripHtmlBlocks } from "./strip-html-blocks";

// Real CommonMark + GFM rendering (bold/italic, real lists, tables, ...) for
// content that has no Gno realm context — a docs page, a GitHub README.
// Deliberately a different renderer from RenderNodeView (realm-browser.tsx),
// which parses Gno's own much narrower Render() dialect and resolves
// relative links against a specific realm; every link here just opens
// externally instead.
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  pre: ({ children }) => {
    const codeElement = Array.isArray(children) ? children[0] : children;
    const codeProps =
      codeElement && typeof codeElement === "object" && "props" in codeElement
        ? (codeElement.props as { className?: string; children?: unknown })
        : undefined;
    const langMatch = /language-(\w+)/.exec(codeProps?.className ?? "");
    const lang = langMatch?.[1];
    const text = String(codeProps?.children ?? "").replace(/\n$/, "");
    return (
      <div className="render-code-block">
        <CodeEditor
          value={text}
          readOnly
          fill={false}
          language={lang === "go" || lang === "gno" ? "go" : "text"}
        />
      </div>
    );
  },
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {stripHtmlBlocks(text)}
      </ReactMarkdown>
    </div>
  );
}
