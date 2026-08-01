import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { FIXTURES } from "./fixtures.js";

export interface MockServerHandle {
  url: string;
  wsUrl: string;
  close(): Promise<void>;
}

function fixtureFor(body: { method?: string; params?: { path?: string } }): unknown {
  if (body.method === "status") return FIXTURES.status;
  if (body.method === "abci_query") {
    const path = body.params?.path ?? "";
    // qpaths carries a limit query string (vm/qpaths?limit=2000), so match
    // on the prefix rather than the whole path.
    if (path.startsWith("vm/qpaths")) return FIXTURES.qpaths;
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
