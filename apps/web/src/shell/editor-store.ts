import { create } from "zustand";

// A one-shot signal from anywhere (Source Explorer's "Fork" button, a future
// entry point) telling the Editor window which script to select once it's
// open — Editor's own activeId is plain component state, so there's no
// other way to reach across windows and say "show this one." Consumed via
// takePendingScriptId(), which clears it so it only fires once.
interface EditorSignalState {
  pendingScriptId: string | null;
  openScript: (id: string) => void;
  takePendingScriptId: () => string | null;
}

export const useEditorSignalStore = create<EditorSignalState>((set, get) => ({
  pendingScriptId: null,
  openScript: (id) => set({ pendingScriptId: id }),
  takePendingScriptId: () => {
    const id = get().pendingScriptId;
    if (id !== null) set({ pendingScriptId: null });
    return id;
  },
}));
