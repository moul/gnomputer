import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSdk } from "./sdk-context";
import { fetchAllGnoSource } from "./realm-source-files";
import type { ExportedSymbol } from "@gnomputer/app-sdk";

// Shared by the Docs and Actions lenses (realm-docs.tsx, realm-actions.tsx) —
// both need every exported symbol across the package, just filtered
// differently, so they share one react-query cache entry instead of each
// re-fetching and re-parsing the same source files.
export function useRealmSymbols(packagePath: string): UseQueryResult<ExportedSymbol[]> {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  return useQuery({
    queryKey: ["realm-symbols", networkId, packagePath],
    queryFn: async () => {
      const fetchedAt = new Date().toISOString();
      const files = await fetchAllGnoSource(sdk, packagePath, fetchedAt);
      return files.flatMap(({ file, source }) => sdk.lenses.parseExportedSymbols(file, source));
    },
    enabled: packagePath !== "",
  });
}
