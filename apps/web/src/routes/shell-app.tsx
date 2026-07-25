import { useEffect, useRef, useState } from "react";
import { useSdk } from "../sdk-context";

// A general-purpose vm/qeval REPL — not scoped to one realm/tab the way
// realm-state.tsx's "Eval" lens is. `cd <packagePath>` sets the current
// package (like a real shell), anything else evaluates as a Gno expression
// against it. Same real, already-proven RPC path as the Eval lens and (per
// gnolang/gno PR #5421) the same one gno.land's own newest built-in
// playground settled on instead of a client-side WASM interpreter — see
// the "Shell/REPL" issue for why gnovm-as-WASM wasn't pursued here.
interface ShellEntry {
  prompt: string;
  input: string;
  output?: string;
  error?: string;
}

export function ShellApp() {
  const sdk = useSdk();
  const [pkg, setPkg] = useState("");
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<ShellEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [, setHistoryIndex] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history]);

  async function run(input: string) {
    const trimmed = input.trim();
    if (!trimmed || pending) return;
    const prompt = pkg ? `${pkg}> ` : "$ ";
    setCommandHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(null);

    const cdMatch = /^cd\s+(\S+)$/.exec(trimmed);
    if (cdMatch) {
      setPkg(cdMatch[1]!);
      setHistory((prev) => [...prev, { prompt, input: trimmed, output: `→ ${cdMatch[1]}` }]);
      setDraft("");
      return;
    }

    if (!pkg) {
      setHistory((prev) => [
        ...prev,
        { prompt, input: trimmed, error: "No package set — run cd <packagePath> first." },
      ]);
      setDraft("");
      return;
    }

    setPending(true);
    try {
      const env = await sdk.rpc.evalExpression(pkg, trimmed, new Date().toISOString());
      setHistory((prev) => [...prev, { prompt, input: trimmed, output: env.data }]);
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { prompt, input: trimmed, error: err instanceof Error ? err.message : String(err) },
      ]);
    } finally {
      setPending(false);
      setDraft("");
    }
  }

  function recall(direction: -1 | 1) {
    if (commandHistory.length === 0) return;
    setHistoryIndex((prev) => {
      const base = prev === null ? commandHistory.length : prev;
      const next = Math.min(Math.max(base + direction, 0), commandHistory.length);
      setDraft(next === commandHistory.length ? "" : commandHistory[next]!);
      return next === commandHistory.length ? null : next;
    });
  }

  return (
    <div className="shell-app" onClick={() => inputRef.current?.focus()}>
      <div className="shell-app__scrollback" ref={scrollRef}>
        <p className="shell-app__hint">
          A general vm/qeval REPL — <code>cd &lt;packagePath&gt;</code> to set the current package,
          then evaluate any Gno expression against it (e.g. <code>Render("")</code>).
        </p>
        {history.map((entry, i) => (
          <div key={i} className="shell-app__entry">
            <div className="shell-app__line">
              <span className="shell-app__prompt">{entry.prompt}</span>
              <span>{entry.input}</span>
            </div>
            {entry.error ? (
              <pre className="shell-app__error" role="alert">
                {entry.error}
              </pre>
            ) : (
              <pre className="shell-app__output">{entry.output}</pre>
            )}
          </div>
        ))}
        <form
          className="shell-app__line shell-app__input-line"
          onSubmit={(e) => {
            e.preventDefault();
            void run(draft);
          }}
        >
          <span className="shell-app__prompt">{pkg ? `${pkg}> ` : "$ "}</span>
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            className="shell-app__input"
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                recall(-1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                recall(1);
              }
            }}
            autoFocus
          />
        </form>
      </div>
    </div>
  );
}
