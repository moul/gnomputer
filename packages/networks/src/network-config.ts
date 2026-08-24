import { z } from "zod";

export const NetworkConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  /**
   * A one-word label for dense chrome, where `name`'s qualifier is noise:
   * the island has room for "Sapphire", not "Sapphire (official testnet)".
   *
   * Optional, because custom networks are stored as whole configs and
   * re-validated on load — requiring this would reject every one saved
   * before it existed. Read it through `networkShortName()`, which falls
   * back to trimming the parenthetical off `name`.
   */
  shortName: z.string().optional(),
  /**
   * A colour to identify the network by, as a CSS colour.
   *
   * The testnets are named after gemstones, so each takes its stone's colour —
   * which makes "am I on the right chain?" answerable at a glance, without
   * reading. Used for a marker beside the name, never for text or as the only
   * cue: a colour that has to carry meaning on its own fails anyone who cannot
   * separate these two blues.
   *
   * Optional, like shortName: custom networks are stored as whole configs and
   * re-validated on load, so requiring it would reject every one saved before
   * it existed.
   */
  color: z.string().optional(),
  chainId: z.string(),
  rpcUrl: z.string().url(),
  websocketUrl: z.string().optional(),
  gnowebUrl: z.string().url().optional(),
  indexerGraphqlUrl: z.string().url().optional(),
  gnockpitUrl: z.string().url().optional(),
  explorerUrl: z.string().url().optional(),
  statusUrl: z.string().url().optional(),
  environment: z.enum(["mainnet", "betanet", "staging", "testnet", "local", "custom"]),
  persistence: z.enum(["persistent", "rolling", "ephemeral", "unknown"]),
  trust: z.enum(["official", "community", "local", "custom"]),
  capabilities: z.array(z.string()),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })).optional(),
});
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;

/**
 * The label to show where space is tight — the island, the network switcher.
 *
 * Falls back to `name` with any trailing parenthetical removed, so a network
 * stored before `shortName` existed still reads as "Sapphire" rather than
 * "Sapphire (official testnet)". A name that is *only* a parenthetical, or
 * becomes empty once trimmed, keeps `name` untouched rather than rendering
 * as nothing.
 * @param {Pick<NetworkConfig, "name" | "shortName">} network the network
 * @returns {string} the short label
 */
export function networkShortName(
  network: Pick<NetworkConfig, "name" | "shortName">
): string {
  if (network.shortName) return network.shortName;
  const trimmed = network.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return trimmed || network.name;
}
