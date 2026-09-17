import { useWindowStore } from "./window-store";

/** Opens (or reopens/focuses) a dedicated app's window by its DEDICATED_APPS
 * id — each one's URL is fixed (dedicated-app-windows.tsx), unlike Explorer/
 * Gnockpit's per-network URLs, so there is nothing to set before focusing. */
export function openDedicatedApp(id: string) {
  const win = useWindowStore.getState().windows[id];
  if (!win) return;
  if (win.closed) useWindowStore.getState().reopen(id);
  else useWindowStore.getState().focus(id);
}
