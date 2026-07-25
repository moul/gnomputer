import { create } from "zustand";

interface NoRenderState {
  /** Package paths confirmed (via a real NoRenderDeclError from vm/qrender)
   * to have no Render() function at all — read by both RealmRenderView
   * (to auto-switch away once, per tab-visit) and the lens tab bar (to
   * gray out the Render tab so there's nothing to click back into). Not
   * cleared: this is a real, permanent fact about the deployed package,
   * not something that stops being true. */
  packagesWithNoRender: Set<string>;
  markNoRender: (packagePath: string) => void;
}

export const useNoRenderStore = create<NoRenderState>((set) => ({
  packagesWithNoRender: new Set(),
  markNoRender: (packagePath) =>
    set((s) => {
      if (s.packagesWithNoRender.has(packagePath)) return s;
      const next = new Set(s.packagesWithNoRender);
      next.add(packagePath);
      return { packagesWithNoRender: next };
    }),
}));
