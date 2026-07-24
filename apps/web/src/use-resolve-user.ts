import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSdk } from "./sdk-context";
import type { ParsedUserData } from "@gnomputer/lenses";

const USERS_PACKAGE = "gno.land/r/sys/users";

// Shared by the Users app and the User Info window's own lookup form
// (address-window.tsx) — both accept the same three input shapes
// (gno.land/r/sys/users.ResolveAny already resolves a plain username, a
// g1 address, or — after stripping it here — an "@username" mention).
export function useResolveUser(query: string | null): UseQueryResult<ParsedUserData> {
  const sdk = useSdk();
  const normalized = query?.replace(/^@/, "").trim() ?? "";

  return useQuery({
    queryKey: ["resolve-user", sdk.networks.getActive().id, normalized],
    queryFn: async () => {
      const env = await sdk.rpc.evalExpression(
        USERS_PACKAGE,
        `ResolveAny("${normalized}")`,
        new Date().toISOString()
      );
      return sdk.lenses.parseUserData(env.data);
    },
    enabled: normalized !== "",
  });
}
