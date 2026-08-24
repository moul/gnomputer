import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fixturesDir = path.join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__");

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf-8"));
}

export const FIXTURES = {
  status: readFixture("status.json"),
  qrender: readFixture("qrender.json"),
  qfile: readFixture("qfile.json"),
  qpaths: readFixture("qpaths.json"),
};

/**
 * Package paths this server answers with a VM error instead of a render.
 *
 * A VM refusal is not a transport failure: the node still answers 200, with
 * `ResponseBase.Error` set and `Data` null. The app branches on the amino type
 * — graying out the Render lens for one, reporting "not found" for the other —
 * so a mock that can only succeed leaves that branch untested.
 */
export const ERROR_PACKAGES: Record<string, string> = {
  // A pure library, or a realm that never declared Render().
  "gno.land/p/mock/norender": "/vm.NoRenderDeclError",
  // Nothing was ever deployed at this path.
  "gno.land/r/mock/missing": "/vm.InvalidPkgPathError",
};

/**
 * Builds the response a node sends when the VM refuses a query.
 *
 * `/vm.NoRenderDeclError` is raised unwrapped, so its log is only the Go dump
 * of the value; `/vm.InvalidPkgPathError` is wrapped with a message, which tm2
 * renders as a `Msg Traces:` block. The app recovers its message from there,
 * so both shapes have to be reproduced faithfully.
 * @param {string} type the amino type URL of the error
 * @param {string} packagePath the package path that was queried
 * @returns {object} the JSON-RPC response body
 */
export function abciErrorResponse(type: string, packagePath: string): unknown {
  const log =
    type === "/vm.InvalidPkgPathError"
      ? [
          "--= Error =--",
          "Data: vm.InvalidPkgPathError{abciError:vm.abciError{}}",
          "Msg Traces:",
          `    0  /gnoroot/gno.land/pkg/sdk/vm/errors.go:58 - package not found: ${packagePath}`,
          "Stack Trace:",
          "    0  /gnoroot/tm2/pkg/errors/errors.go:93",
        ].join("\n")
      : "vm.NoRenderDeclError{abciError:vm.abciError{}}";

  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      response: {
        ResponseBase: { Error: { "@type": type }, Data: null, Events: null, Log: log, Info: "" },
        Key: null,
        Value: null,
        Proof: null,
        Height: "0",
      },
    },
  };
}
