import { z } from "zod";

export const EntityKindSchema = z.enum([
  "network",
  "realm",
  "package",
  "source-file",
  "function",
  "type",
  "state-object",
  "address",
  "identity",
  "account",
  "balance",
  "transaction",
  "transaction-message",
  "block",
  "event",
  "proposal",
  "validator",
  "local-workspace",
  "local-file",
  "process",
  "trail",
]);
export type EntityKind = z.infer<typeof EntityKindSchema>;

export const LensIdSchema = z.enum([
  "experience",
  "source",
  "docs",
  "state",
  "history",
  "actions",
  "graph",
  "raw",
  "time",
]);
export type LensId = z.infer<typeof LensIdSchema>;

export const EntityRefSchema = z.object({
  uri: z.string(),
  kind: EntityKindSchema,
  networkId: z.string(),
  chainId: z.string().optional(),
  packagePath: z.string().optional(),
  objectId: z.string().optional(),
  filePath: z.string().optional(),
  functionName: z.string().optional(),
  height: z.union([z.number(), z.literal("latest")]).optional(),
  lens: LensIdSchema.optional(),
  query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  adapterVersion: z.string().optional(),
});
export type EntityRef = z.infer<typeof EntityRefSchema>;
