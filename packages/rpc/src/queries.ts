import { Tm2Client } from "@gnolang/tm2-rpc";
import { JSONRPCProvider } from "@gnolang/tm2-js-client";

export function connectTm2Client(rpcUrl: string): Promise<Tm2Client> {
  return Tm2Client.connect(rpcUrl);
}

export function connectProvider(rpcUrl: string): Promise<JSONRPCProvider> {
  return JSONRPCProvider.create(rpcUrl);
}

export async function abciQueryString(client: Tm2Client, path: string, data: string): Promise<string> {
  const result = await client.abciQuery({ path, data: new TextEncoder().encode(data) });
  return new TextDecoder().decode(result.responseBase.data);
}

export interface RawValidator {
  address: string;
  voting_power: string;
  proposer_priority: string;
}

// Deliberately bypasses Tm2Client.validators()'s typed decoder: it turns the
// wire response's `address` (already a correct bech32 "g1..." string) into
// raw bytes, which would force us to bech32-encode it back ourselves to show
// anything human-readable — real risk of computing a wrong checksum/prefix
// and displaying a plausible-looking but incorrect address. The raw JSON-RPC
// response already has exactly the string we want.
export async function fetchValidatorsRaw(
  rpcUrl: string,
  height: number
): Promise<{ blockHeight: number; validators: RawValidator[] }> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "validators",
      params: { height: String(height) },
    }),
  });
  const body = await res.json();
  if (body.error) {
    throw new Error(typeof body.error === "string" ? body.error : JSON.stringify(body.error));
  }
  return {
    blockHeight: Number(body.result.block_height),
    validators: body.result.validators,
  };
}

export interface RawChainEvent {
  type: string;
  pkg_path?: string;
  attrs?: { key: string; value: string }[];
}

export interface RawDeliverTx {
  ResponseBase: { Error: unknown; Events: RawChainEvent[] | null };
  GasWanted: string;
  GasUsed: string;
}

// block_results is a *separate* top-level RPC method from abci_query (it
// asks for the ABCI execution results of a block, not a state query) — no
// existing helper here calls it, so this is a fresh raw fetch like
// fetchValidatorsRaw above. Confirmed live (not just plausible): a real
// block's deliver_tx entries carry actual human-readable Events (type,
// attrs, pkg_path) with no indexer and no CORS issue, since this hits the
// same RPC host every other query already uses.
export async function fetchBlockResultsRaw(
  rpcUrl: string,
  height: number
): Promise<{ height: number; deliverTx: RawDeliverTx[] }> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "block_results",
      params: { height: String(height) },
    }),
  });
  const body = await res.json();
  if (body.error) {
    throw new Error(typeof body.error === "string" ? body.error : JSON.stringify(body.error));
  }
  const deliverTx = body.result.results.deliver_tx;
  return {
    height: Number(body.result.height),
    deliverTx: Array.isArray(deliverTx) ? deliverTx : [],
  };
}
