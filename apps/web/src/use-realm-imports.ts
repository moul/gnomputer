import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSdk } from "./sdk-context";
import { fetchAllGnoSource } from "./realm-source-files";
import type { ParsedImport } from "@gnomputer/app-sdk";

export function useRealmImports(packagePath: string): UseQueryResult<ParsedImport[]> {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  return useQuery({
    queryKey: ["realm-imports", networkId, packagePath],
    queryFn: async () => {
      const fetchedAt = new Date().toISOString();
      const files = await fetchAllGnoSource(sdk, packagePath, fetchedAt);
      const all = files.flatMap(({ source }) => sdk.lenses.parseImports(source));
      // De-duplicate across files — the same stdlib (or shared p/ package) is
      // routinely imported by more than one .gno file in a realm.
      const seen = new Map<string, ParsedImport>();
      for (const imp of all) if (!seen.has(imp.path)) seen.set(imp.path, imp);
      return [...seen.values()];
    },
    enabled: packagePath !== "",
  });
}
