export const PROBE_TIMEOUT_MS = 8000;

export type ProbeFailure =
  | "mixed-content"
  | "unreachable"
  | "http-error"
  | "not-a-gno-rpc"
  | "timeout";

export type ProbeResult =
  | { ok: true; chainId: string; height: number; latencyMs: number }
  | { ok: false; reason: ProbeFailure; message: string };

/** Chrome and Firefox treat these as potentially-trustworthy origins, so an
 * https page may call them over plain http. Anything else on http from an
 * https page is blocked before a request is even sent. */
function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
}

export function isLocalEndpoint(rpcUrl: string): boolean {
  try {
    return isLocalHost(new URL(rpcUrl).hostname);
  } catch {
    return false;
  }
}

/** Checks an RPC endpoint before it is saved, and reports back what it is.
 *
 * Adding a custom network used to accept any http(s) URL, save it with
 * `chainId: "unknown"`, and switch to it. Nothing confirmed the endpoint
 * existed, spoke Gno, or was the chain the user meant — and because signing
 * refuses a chain ID of "unknown", every custom network was permanently
 * unable to sign anything (AUD-027).
 *
 * The failure cases are separated because the fixes are completely
 * different: a mixed-content block needs an https endpoint, a CORS block
 * needs a change on the server, and a wrong path needs a different URL.
 * "Could not connect" covers all three and helps with none. */
export async function probeNetwork(rpcUrl: string): Promise<ProbeResult> {
  let url: URL;
  try {
    url = new URL(rpcUrl);
  } catch {
    return { ok: false, reason: "unreachable", message: "That doesn't look like a valid URL." };
  }

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    url.protocol === "http:" &&
    !isLocalHost(url.hostname)
  ) {
    return {
      ok: false,
      reason: "mixed-content",
      message:
        "Gnomputer is served over https, and browsers block plain-http requests from an https page. This endpoint needs to be https:// (http:// is allowed only for localhost).",
    };
  }

  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // params must be an OBJECT. Tendermint2's status handler rejects an
      // empty array with "expected 1 parameters ([heightGte]), got 0".
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "status", params: {} }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return {
        ok: false,
        reason: "timeout",
        message: `No response within ${PROBE_TIMEOUT_MS / 1000}s. The endpoint may be down or very slow.`,
      };
    }
    return {
      ok: false,
      reason: "unreachable",
      message: isLocalHost(url.hostname)
        ? "Could not reach it. Check the node is running on that port, and that it allows requests from this page — a browser needs the endpoint to send CORS headers, which a node started for CLI use often does not."
        : "Could not reach it. Either the host is unreachable, or it refused the request because it does not send CORS headers allowing this page to call it. That has to be fixed on the endpoint; a browser cannot work around it.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "http-error",
      message: `The endpoint answered ${response.status} ${response.statusText}. Check the URL — an RPC endpoint is often served at a path like /websocket's sibling root, not under a page URL.`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      reason: "not-a-gno-rpc",
      message: "The endpoint answered, but not with JSON. This is probably a web page, not an RPC endpoint.",
    };
  }

  const result = (body as { result?: { node_info?: { network?: unknown }; sync_info?: { latest_block_height?: unknown } } })?.result;
  const chainId = result?.node_info?.network;
  if (typeof chainId !== "string" || chainId === "") {
    return {
      ok: false,
      reason: "not-a-gno-rpc",
      message: "The endpoint answered, but not like a Tendermint2 node — no chain ID in its status response.",
    };
  }

  return {
    ok: true,
    chainId,
    height: Number(result?.sync_info?.latest_block_height ?? 0),
    latencyMs: Math.round(performance.now() - startedAt),
  };
}
