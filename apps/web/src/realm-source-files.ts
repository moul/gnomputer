import type { GnomputerSDK } from "@gnomputer/app-sdk";

/** Lists a package's real (non-test) .gno source files, in the order
 * vm/qfile returns them — shared by anything that needs to parse every
 * file in a realm (symbols, imports), not just the one currently open in
 * the Source lens. */
export async function fetchGnoFiles(
  sdk: GnomputerSDK,
  packagePath: string,
  fetchedAt: string
): Promise<string[]> {
  const env = await sdk.rpc.queryFile(packagePath, fetchedAt);
  return env.data
    .split("\n")
    .map((line) => line.trim())
    .filter((file) => file.endsWith(".gno") && !file.endsWith("_test.gno"));
}

export async function fetchAllGnoSource(
  sdk: GnomputerSDK,
  packagePath: string,
  fetchedAt: string
): Promise<{ file: string; source: string }[]> {
  const files = await fetchGnoFiles(sdk, packagePath, fetchedAt);
  return Promise.all(
    files.map(async (file) => {
      const env = await sdk.rpc.queryFile(`${packagePath}/${file}`, fetchedAt);
      return { file, source: env.data };
    })
  );
}
