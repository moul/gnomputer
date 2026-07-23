import { useState } from "react";
import { useSdk } from "../sdk-context";

interface EvalEntry {
  expression: string;
  result?: string;
  error?: string;
}

// A live Gno expression console scoped to one realm, backed directly by
// vm/qeval — the same RPC path already used internally to resolve usernames,
// generalized here into first-class "current state" access (spec §9.4).
export function RealmState({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [log, setLog] = useState<EvalEntry[]>([]);

  async function evaluate(expression: string) {
    const trimmed = expression.trim();
    if (!trimmed || pending) return;
    setPending(true);
    try {
      const env = await sdk.rpc.evalExpression(packagePath, trimmed, new Date().toISOString());
      setLog((prev) => [...prev, { expression: trimmed, result: env.data }]);
    } catch (err) {
      setLog((prev) => [
        ...prev,
        { expression: trimmed, error: err instanceof Error ? err.message : String(err) },
      ]);
    } finally {
      setPending(false);
      setDraft("");
    }
  }

  return (
    <div className="realm-state">
      <p className="state-line">
        Evaluate a Gno expression against {packagePath}&rsquo;s current on-chain state.
      </p>
      <form
        className="realm-state__form"
        onSubmit={(e) => {
          e.preventDefault();
          void evaluate(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='Render("") or an exported var name'
          disabled={pending}
        />
        <button type="submit" disabled={pending || !draft.trim()}>
          {pending ? "Evaluating…" : "Evaluate"}
        </button>
      </form>
      {log.length === 0 ? (
        <p className="state-line">No expressions evaluated yet this session.</p>
      ) : (
        <ul className="realm-state__log">
          {log.map((entry, i) => (
            <li key={i} className="realm-state__entry">
              <div className="realm-state__expr">
                {packagePath}.{entry.expression}
              </div>
              {entry.error ? (
                <pre className="realm-state__error" role="alert">
                  {entry.error}
                </pre>
              ) : (
                <pre className="realm-state__result">{entry.result}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
