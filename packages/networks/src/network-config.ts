import { z } from "zod";

export const NetworkConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
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
