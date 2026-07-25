import { useWindowStore } from "./window-store";
import { useDiscoverStore, type DiscoverTab } from "./discover-store";

export function openDiscoverTab(tab: DiscoverTab) {
  useDiscoverStore.getState().setTab(tab);
  useWindowStore.getState().reopen("discover");
}
