import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useRealmSuggestions } from "../shell/use-realm-suggestions";

// A general-purpose vm/qeval REPL — not scoped to one realm/tab the way
// realm-state.tsx's "Eval" lens is. `cd <packagePath>` sets the current
// package (like a real shell), anything else evaluates as a Gno expression
// against it. Same real, already-proven RPC path as the Eval lens and (per
// gnolang/gno PR #5421) the same one gno.land's own newest built-in
// playground settled on instead of a client-side WASM interpreter — see
// the "Shell/REPL" issue for why gnovm-as-WASM wasn't pursued here.
//
// `funcs` (vm/qfuncs, sdk.rpc.queryFuncs) is a lightweight, deliberately
// read-only-safe borrow from gnolang/gno's own gnopie CLI (PR #5444, an
// "httpie for gno.land"): real function-signature introspection so you
// don't have to already know a package's function names/params before
// typing an eval expression against it. NOT borrowed from that PR: its
// auto-`cross(...)`-wrapping for crossing functions — that needs the exact
// call syntax verified against a real signed transaction, which isn't
// something this read-only qeval shell can safely check, so a crossing
// function is only flagged with "[crossing]" here, not auto-rewritten.
interface ShellEntry {
  prompt: string;
  input: string;
  output?: string;
  error?: string;
}

export interface FuncParam {
  Name: string;
  Type: string;
}

export interface FuncSignature {
  FuncName: string;
  Params: FuncParam[] | null;
  Results: FuncParam[] | null;
}

// A crossing function's first param has a Type string that's the fully-
// expanded realm-interface shape (confirmed live against
// gno.land/r/gnoland/blog: ModAddPost's unnamed `realm` param comes back
// named ".arg_0", but NewPostProposalRequest's explicitly-named `cur realm`
// param keeps its real name "cur" — so detection has to key on the TYPE
// fingerprint of the FIRST param specifically, not the name, which varies
// depending on whether the source named the param at all). Not something
// the caller ever types themselves either way, so it's hidden from the
// formatted signature rather than shown as a real parameter.
const CROSSING_TYPE_FINGERPRINT = ".uverse.realm";

export function isCrossingSignature(fn: FuncSignature): boolean {
  const first = fn.Params?.[0];
  return !!first && first.Type.includes(CROSSING_TYPE_FINGERPRINT);
}

export function formatFuncSignature(fn: FuncSignature): string {
  const crossing = isCrossingSignature(fn);
  const params = crossing ? (fn.Params ?? []).slice(1) : (fn.Params ?? []);
  const paramList = params.map((p) => `${p.Name} ${p.Type}`).join(", ");
  const results = fn.Results ?? [];
  const resultList = results.length > 0 ? `: ${results.map((r) => r.Type).join(", ")}` : "";
  return `${fn.FuncName}(${paramList})${resultList}${crossing ? " [crossing]" : ""}`;
}

const HELP_TEXT = [
  "cd <packagePath>   Set the current package",
  "ls, dir            List files in the current package (vm/qfile)",
  "funcs              List exported function signatures (vm/qfuncs)",
  "pwd                Show the current package path",
  "help, ?            Show this help",
  '<expression>       Evaluate a Gno expression against the current package (e.g. Render(""))',
  "",
  "↑ / ↓ recall previous commands",
  "Autocomplete suggests package paths after \"cd \", and function names once a package is set",
].join("\n");

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

    if (trimmed === "help" || trimmed === "?") {
      setHistory((prev) => [...prev, { prompt, input: trimmed, output: HELP_TEXT }]);
      setDraft("");
      return;
    }

    if (trimmed === "pwd") {
      setHistory((prev) => [...prev, { prompt, input: trimmed, output: pkg || "(no package set)" }]);
      setDraft("");
      return;
    }

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
      const output =
        trimmed === "funcs"
          ? await listFuncs(pkg)
          : trimmed === "ls" || trimmed === "dir"
            ? await listFiles(pkg)
            : (await sdk.rpc.evalExpression(pkg, trimmed, new Date().toISOString())).data;
      setHistory((prev) => [...prev, { prompt, input: trimmed, output }]);
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

  async function listFuncs(packagePath: string): Promise<string> {
    const env = await sdk.rpc.queryFuncs(packagePath, new Date().toISOString());
    const signatures: FuncSignature[] = JSON.parse(env.data);
    if (signatures.length === 0) return "(no exported functions found)";
    return signatures.map(formatFuncSignature).join("\n");
  }

  async function listFiles(packagePath: string): Promise<string> {
    const env = await sdk.rpc.queryFile(packagePath, new Date().toISOString());
    const files = env.data
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return files.length === 0 ? "(no files found)" : files.join("\n");
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

  // Autocomplete, native-<datalist>-based (same pattern the Browser's own
  // realm-path field uses) — two distinct sources depending on what's
  // being typed:
  //  1. "cd <partial path>" reuses useRealmSuggestions, the exact same
  //     RPC-prefix + indexer-substring + known-realms + live-activity
  //     mix the Browser's url bar already uses.
  //  2. Once a package is set, a bare identifier being typed (no "("
  //     yet — past that, they're typing arguments, not a function name)
  //     suggests real exported function names via the same vm/qfuncs
  //     data the `funcs` command already fetches.
  const cdMatch = /^cd\s+(\S*)$/.exec(draft);
  const cdQuery = cdMatch?.[1] ?? "";
  const realmSuggestions = useRealmSuggestions(cdMatch !== null, cdQuery);

  const networkId = sdk.networks.getActive().id;
  const { data: funcSignatures } = useQuery({
    queryKey: ["shell-funcs", networkId, pkg],
    queryFn: async () => {
      const env = await sdk.rpc.queryFuncs(pkg, new Date().toISOString());
      return JSON.parse(env.data) as FuncSignature[];
    },
    enabled: pkg !== "",
  });

  const bareIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/.test(draft.trim()) ? draft.trim() : null;
  const funcNameSuggestions =
    pkg && cdMatch === null && bareIdentifier
      ? (funcSignatures ?? [])
          .map((f) => f.FuncName)
          .filter((name) => name.toLowerCase().startsWith(bareIdentifier.toLowerCase()))
      : [];

  const suggestions: { value: string; label: string }[] =
    cdMatch !== null
      ? realmSuggestions.map((s) => ({ value: `cd ${s.packagePath}`, label: s.label }))
      : funcNameSuggestions.map((name) => ({ value: name, label: name }));

  return (
    <div className="shell-app" onClick={() => inputRef.current?.focus()}>
      <div className="shell-app__scrollback" ref={scrollRef}>
        <p className="shell-app__hint">
          A general vm/qeval REPL — <code>cd &lt;packagePath&gt;</code> to set the current package,
          then evaluate any Gno expression against it (e.g. <code>Render("")</code>). Run{" "}
          <code>help</code> for the full command list.
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
            list="shell-app-suggestions"
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
          <datalist id="shell-app-suggestions">
            {suggestions.map((s) => (
              <option key={s.value} value={s.value} label={s.label} />
            ))}
          </datalist>
        </form>
      </div>
    </div>
  );
}
