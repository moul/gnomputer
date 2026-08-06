import type { IndexerMessage } from "@gnomputer/app-sdk";
import { formatUgnotString } from "../format-number";

/** A one-line, plain-language headline for a transaction message — the
 * answer to "what did this actually do", which is the question a block's
 * transaction list exists to answer and could not before.
 *
 * Deliberately does NOT include the addresses: those are rendered
 * separately as clickable entity links, and repeating a g1… in prose makes
 * the line unreadable at the width a block detail pane actually has. */
export function describeTxMessage(message: IndexerMessage): string {
  switch (message.kind) {
    case "send":
      return `Sent ${formatUgnotString(message.amount)}`;
    case "call": {
      const call = `Called ${message.func}() on ${message.packagePath}`;
      return message.send ? `${call}, sending ${formatUgnotString(message.send)}` : call;
    }
    case "addpkg":
      return `Deployed ${message.packageName || message.packagePath}`;
    case "run":
      return message.send ? `Ran a script, sending ${formatUgnotString(message.send)}` : "Ran a script";
    case "unknown":
      return `${message.route}/${message.typeUrl}`;
  }
}
