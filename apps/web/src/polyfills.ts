import { Buffer } from "buffer";

declare global {
  var Buffer: typeof import("buffer").Buffer;
}

// @gnolang/tm2-js-client's response decoders call Buffer.from(...).toString("base64")
// internally — a Node global with no browser equivalent. Vite doesn't polyfill it the
// way webpack's node-libs shims used to, so without this, every account/balance lookup
// throws "ReferenceError: Buffer is not defined" the moment it tries to decode a
// response. Must run before any module that transitively imports tm2-js-client.
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}
