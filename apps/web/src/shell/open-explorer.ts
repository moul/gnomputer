import { useWindowStore } from "./window-store";
import { useExplorerWindowStore } from "./explorer-window-store";

/** Opens (or reopens/focuses) the dedicated Explorer window at `url`. */
export function openExplorer(url: string) {
  useExplorerWindowStore.getState().setUrl(url);
  const win = useWindowStore.getState().windows.explorer;
  if (!win) return;
  if (win.closed) useWindowStore.getState().reopen("explorer");
  else useWindowStore.getState().focus("explorer");
}
