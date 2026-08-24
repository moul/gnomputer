import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { abciErrorResponse, ERROR_PACKAGES, FIXTURES } from "./fixtures.js";

export interface MockServerHandle {
  url: string;
  wsUrl: string;
  close(): Promise<void>;
}

/**
 * Recovers the package path a VM query was asking about.
 *
 * `data` is base64 of the query arguments joined by a separator — for
 * `vm/qrender` that is `<pkgPath>:<renderPath>`, for `vm/qfile` just the
 * package path. Only the leading package path is needed here.
 * @param {string} [data] the base64 `params.data` of the abci_query
 * @returns {string} the package path, or "" when it cannot be read
 */
function queriedPackagePath(data?: string): string {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64").toString("utf-8").split(":")[0] ?? "";
  } catch {
    return "";
  }
}

function fixtureFor(body: { method?: string; params?: { path?: string; data?: string } }): unknown {
  if (body.method === "status") return FIXTURES.status;
  if (body.method === "abci_query") {
    const path = body.params?.path ?? "";
    // qpaths carries a limit query string (vm/qpaths?limit=2000), so match
    // on the prefix rather than the whole path.
    if (path.startsWith("vm/qpaths")) return FIXTURES.qpaths;

    // A handful of paths stand in for packages the VM refuses, so the app's
    // error branches are reachable offline. Applied to qfile too: a package
    // that does not exist has no source either.
    const packagePath = queriedPackagePath(body.params?.data);
    const errorType = ERROR_PACKAGES[packagePath];
    if (errorType && (path === "vm/qrender" || path === "vm/qfile")) {
      // A missing package fails every query; a package that merely declares no
      // Render still has source to serve.
      if (errorType !== "/vm.NoRenderDeclError" || path === "vm/qrender") {
        return abciErrorResponse(errorType, packagePath);
      }
    }

    if (path === "vm/qfile") return FIXTURES.qfile;
    return FIXTURES.qrender;
  }
  return { jsonrpc: "2.0", id: 1, result: {} };
}

export function createMockServer(port = 0): Promise<MockServerHandle> {
  const server = createServer((req, res) => {
    // A JSON-RPC POST carries `content-type: application/json`, which is not
    // a CORS-safelisted content type — so the browser sends a preflight
    // OPTIONS first. Without answering it the real request never happens and
    // the app just sees "Failed to fetch".
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, GET, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
      });
      res.end();
      return;
    }

    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.setHeader("access-control-allow-origin", "*");
      let body: { method?: string; params?: { path?: string } } = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        // fall through with an empty body — treated as an unknown method below
      }
      res.end(JSON.stringify(fixtureFor(body)));
    });
  });

  const wss = new WebSocketServer({ server });
  const interval = setInterval(() => {
    for (const client of wss.clients) {
      client.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          result: { data: { type: "tendermint/event/NewBlock" } },
        })
      );
    }
  }, 3000);

  return new Promise((resolve) => {
    server.listen(port, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      resolve({
        url: `http://127.0.0.1:${actualPort}`,
        wsUrl: `ws://127.0.0.1:${actualPort}`,
        close: () =>
          new Promise((res) => {
            clearInterval(interval);
            wss.close();
            server.close(() => res());
          }),
      });
    });
  });
}
