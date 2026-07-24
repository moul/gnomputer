import type { GnomputerSDK } from "@gnomputer/app-sdk";
import { useEditorSignalStore } from "./editor-store";
import { focusOrReopen } from "./open-ref";

/** Copies a single file's content into a new local Editor script and
 * switches the Editor window to it — Editor only ever holds one code
 * string per script (see editor.tsx), so forking a whole multi-file realm
 * means forking whichever file is currently open, the same way "fork this
 * gist" only forks the gist you're looking at. */
export async function forkFile(sdk: GnomputerSDK, name: string, code: string): Promise<void> {
  const record = await sdk.scripts.create(name, code);
  useEditorSignalStore.getState().openScript(record.id);
  focusOrReopen("editor");
}
