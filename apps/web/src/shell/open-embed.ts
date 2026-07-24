import { useWindowStore } from "./window-store";
import { useEmbedWindowStore } from "./embed-window-store";

/** Opens (or reopens/focuses) the singleton Embed window showing `url` in an
 * iframe — used for third-party tools that are curated, trusted URLs from
 * network-config.ts (mygnoscan, Gnockpit), not arbitrary user input. */
export function openEmbed(url: string, title: string) {
  useEmbedWindowStore.getState().setEmbed(url, title);
  const win = useWindowStore.getState().windows.embed;
  if (!win) return;
  if (win.closed) useWindowStore.getState().reopen("embed");
  else useWindowStore.getState().focus("embed");
}
