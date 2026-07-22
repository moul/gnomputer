import { z } from "zod";
import { EntityRefSchema } from "@gnomputer/entities";

export const DataWarningSchema = z.object({ code: z.string(), message: z.string() });
export type DataWarning = z.infer<typeof DataWarningSchema>;

export const DataEnvelopeSchema = z.object({
  ref: EntityRefSchema,
  data: z.unknown(),
  source: z.enum(["rpc", "indexer", "gnoweb", "wallet", "companion", "cache", "derived"]),
  consistency: z.enum(["authoritative", "indexed", "derived", "best-effort"]),
  networkId: z.string(),
  chainId: z.string().optional(),
  height: z.number().optional(),
  fetchedAt: z.string(),
  freshness: z.enum(["live", "cached", "stale", "historical"]),
  schema: z.string(),
  warnings: z.array(DataWarningSchema).optional(),
});

type DataEnvelopeBase = z.infer<typeof DataEnvelopeSchema>;
export type DataEnvelope<T> = Omit<DataEnvelopeBase, "data"> & { data: T };

export function wrapEnvelope<T>(input: DataEnvelope<T>): DataEnvelope<T> {
  const result = DataEnvelopeSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid DataEnvelope: ${result.error.message}`);
  }
  return input;
}
