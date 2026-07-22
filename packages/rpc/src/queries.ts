import { Tm2Client } from "@gnolang/tm2-rpc";

export function connectTm2Client(rpcUrl: string): Promise<Tm2Client> {
  return Tm2Client.connect(rpcUrl);
}

export async function abciQueryString(client: Tm2Client, path: string, data: string): Promise<string> {
  const result = await client.abciQuery({ path, data: new TextEncoder().encode(data) });
  return new TextDecoder().decode(result.responseBase.data);
}
