import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { FIXTURES } from "./fixtures";

export interface MockServerHandle {
  url: string;
  wsUrl: string;
  close(): Promise<void>;
}

function fixtureFor(body: { method?: string; params?: { path?: string } }): unknown {
  if (body.method === "status") return FIXTURES.status;
  if (body.method === "abci_query") {
    return body.params?.path === "vm/qfile" ? FIXTURES.qfile : FIXTURES.qrender;
  }
  return { jsonrpc: "2.0", id: 1, result: {} };
}

export function createMockServer(port = 0): Promise<MockServerHandle> {
  const server = createServer((req, res) => {
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
