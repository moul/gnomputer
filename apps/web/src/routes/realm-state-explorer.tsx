import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { ErrorState } from "../shell/error-state";

// A real, browsable tree of a package's persisted on-chain state — the
// same backend gnoweb's own State Explorer tab uses (gnolang/gno PR
// #5283: vm/qpkg_json, vm/qobject_json, vm/qtype_json — confirmed live,
// reachable via plain abci_query, not just gnoweb's own bespoke $state
// HTTP route). Distinct from this app's "Eval" lens (realm-state.tsx),
// which runs ad-hoc vm/qeval expressions rather than browsing the whole
// declared-state tree.
//
// The Amino JSON schema these three endpoints return is large (Gno's full
// value/type model: primitives, pointers, refs, structs, maps, slices,
// interfaces, closures, cycles — see @gnojs/amino in the upstream PR for
// the complete decoder). This implements the common, confirmed-live path
// (primitives, pointer/ref lazy-loading via ObjectID, struct field-name
// resolution via qtype_json) and shows anything else as-is rather than
// guessing at an undecoded shape — same "disclose the gap" approach as
// the Graph lens before it got a real mygnoscan embed.

interface TypeNode {
  "@type": string;
  [key: string]: unknown;
}

interface ValueNode {
  "@type"?: string;
  [key: string]: unknown;
}

interface Declaration {
  T?: TypeNode;
  V?: ValueNode;
}

interface PkgJson {
  names: string[];
  values: Declaration[];
}

interface ObjectJson {
  objectid: string;
  value: ValueNode;
}

interface TypeJson {
  typeid: string;
  type: {
    "@type": string;
    Base?: { "@type": string; Fields?: { Name: string; Type: TypeNode }[] };
  };
}

function typeSummary(t: TypeNode | undefined): string {
  if (!t) return "(unknown type)";
  switch (t["@type"]) {
    case "/gno.PrimitiveType":
      return `kind ${t.value}`;
    case "/gno.RefType":
      return String(t.ID);
    case "/gno.PointerType":
      return `*${typeSummary(t.Elt as TypeNode)}`;
    case "/gno.DeclaredType":
      return `${t.PkgPath}.${t.Name}`;
    case "/gno.FuncType":
      return "func(...)";
    case "/gno.InterfaceType":
      return "interface{}";
    default:
      return String(t["@type"]).replace("/gno.", "");
  }
}

// Struct field names live on the TYPE (vm/qtype_json), not the value — the
// value's Fields array only carries values, in the same order the type
// declares them. A pointer's Elt (or a bare RefType) is where that type id
// lives; declared types elsewhere already carry their own id inline.
function refTypeId(t: TypeNode | undefined): string | null {
  if (!t) return null;
  if (t["@type"] === "/gno.RefType") return t.ID as string;
  if (t["@type"] === "/gno.PointerType") return refTypeId(t.Elt as TypeNode);
  return null;
}

function ValueNodeView({ typeNode, valueNode }: { typeNode: TypeNode | undefined; valueNode: ValueNode | undefined }) {
  if (!valueNode) return <span className="state-explorer__scalar">nil</span>;
  const vType = valueNode["@type"];

  if (
    "value" in valueNode &&
    (typeof valueNode.value === "string" ||
      typeof valueNode.value === "number" ||
      typeof valueNode.value === "boolean")
  ) {
    return <span className="state-explorer__scalar">{String(valueNode.value)}</span>;
  }

  if (vType === "/gno.HeapItemValue") {
    const inner = (valueNode.Value as Declaration | undefined) ?? {};
    return <ValueNodeView typeNode={inner.T} valueNode={inner.V} />;
  }

  if (vType === "/gno.StructValue") {
    return <StructValueView typeNode={typeNode} fields={(valueNode.Fields as Declaration[] | undefined) ?? []} />;
  }

  if (vType === "/gno.PointerValue" || vType === "/gno.RefValue") {
    const base = (vType === "/gno.PointerValue" ? valueNode.Base : valueNode) as
      | { ObjectID?: string }
      | undefined;
    if (!base?.ObjectID) return <span className="state-explorer__scalar">nil</span>;
    return <LazyObject objectId={base.ObjectID} typeNode={typeNode} />;
  }

  return (
    <span className="state-explorer__unsupported">
      ({(vType ?? "unknown").replace("/gno.", "")} not decoded yet)
    </span>
  );
}

function LazyObject({ objectId, typeNode }: { objectId: string; typeNode: TypeNode | undefined }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const [expanded, setExpanded] = useState(false);

  const {
    data,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["state-object", networkId, objectId],
    queryFn: async () => {
      const env = await sdk.rpc.queryObjectJson(objectId, new Date().toISOString());
      return JSON.parse(env.data) as ObjectJson;
    },
    enabled: expanded,
  });

  return (
    <div className="state-explorer__node">
      <button type="button" className="state-explorer__toggle" onClick={() => setExpanded((e) => !e)}>
        {expanded ? "▾" : "▸"} {typeSummary(typeNode)}
      </button>
      {expanded &&
        (error ? (
          <ErrorState message="Could not load object" error={error} onRetry={() => void refetch()} />
        ) : isPending || !data ? (
          <span className="state-line" aria-busy="true">
            Loading…
          </span>
        ) : (
          <ValueNodeView typeNode={typeNode} valueNode={data.value} />
        ))}
    </div>
  );
}

function StructValueView({ typeNode, fields }: { typeNode: TypeNode | undefined; fields: Declaration[] }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const typeId = refTypeId(typeNode);

  const { data: typeJson } = useQuery({
    queryKey: ["state-type", networkId, typeId],
    queryFn: async () => {
      const env = await sdk.rpc.queryTypeJson(typeId!, new Date().toISOString());
      return JSON.parse(env.data) as TypeJson;
    },
    enabled: typeId !== null,
  });

  const fieldNames = typeJson?.type.Base?.Fields?.map((f) => f.Name);

  return (
    <ul className="state-explorer__fields">
      {fields.map((f, i) => (
        <li key={i}>
          <span className="state-explorer__field-name">{fieldNames?.[i] ?? `field ${i}`}</span>:{" "}
          <ValueNodeView typeNode={f.T} valueNode={f.V} />
        </li>
      ))}
    </ul>
  );
}

export function RealmStateExplorer({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["state-pkg", networkId, packagePath],
    queryFn: async () => {
      const env = await sdk.rpc.queryPkgJson(packagePath, new Date().toISOString());
      return JSON.parse(env.data) as PkgJson;
    },
  });

  if (error) {
    return (
      <ErrorState message="Could not load package state" error={error} onRetry={() => void refetch()} />
    );
  }
  if (isPending || !data) {
    return (
      <p className="state-line" aria-busy="true">
        Loading package state…
      </p>
    );
  }

  return (
    <div className="state-explorer">
      <p className="state-line">
        Real persisted state for {packagePath}, decoded from vm/qpkg_json — the same backend
        gnoweb&rsquo;s own State Explorer uses. Click a name to expand it. Maps, slices, and a few
        other types aren&rsquo;t decoded yet.
      </p>
      {data.names.length === 0 ? (
        <p className="state-line">No top-level declarations found.</p>
      ) : (
        <ul className="state-explorer__list">
          {data.names.map((name, i) => (
            <li key={name}>
              <span className="state-explorer__decl-name">{name}</span>{" "}
              <ValueNodeView typeNode={data.values[i]!.T} valueNode={data.values[i]!.V} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
