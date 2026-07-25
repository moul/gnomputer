import { useWindowStore } from "./window-store";
import { useGnockpitEmbedWindowStore } from "./gnockpit-embed-window-store";

/** Opens (or reopens/focuses) the dedicated Gnockpit embed window at `url`. */
export function openGnockpitEmbed(url: string) {
  useGnockpitEmbedWindowStore.getState().setUrl(url);
  const win = useWindowStore.getState().windows["gnockpit-embed"];
  if (!win) return;
  if (win.closed) useWindowStore.getState().reopen("gnockpit-embed");
  else useWindowStore.getState().focus("gnockpit-embed");
}
