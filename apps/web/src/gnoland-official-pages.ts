// gno.land's own top-level pages, straight from gnoweb's DefaultAliases
// (gno.land/pkg/gnoweb/app.go — confirmed against that exact source). These
// are what a short URL like gno.land/about actually renders under the hood.
// Deliberately not existence-checked or otherwise managed here — if one
// isn't deployed yet on whatever network is active, it just shows the same
// "Could not load this realm" state (with its own Try Again) as any other
// realm path would.
export interface OfficialPage {
  label: string;
  packagePath: string;
  renderPath?: string;
}

export const GNOLAND_OFFICIAL_PAGES: OfficialPage[] = [
  { label: "Home", packagePath: "gno.land/r/gnoland/home" },
  { label: "About", packagePath: "gno.land/r/gnoland/pages", renderPath: "p/about" },
  { label: "Gno language", packagePath: "gno.land/r/gnoland/pages", renderPath: "p/gnolang" },
  { label: "Ecosystem", packagePath: "gno.land/r/gnoland/pages", renderPath: "p/ecosystem" },
  { label: "Getting started", packagePath: "gno.land/r/gnoland/pages", renderPath: "p/start" },
  { label: "License", packagePath: "gno.land/r/gnoland/pages", renderPath: "p/license" },
  { label: "Contribute", packagePath: "gno.land/r/gnoland/pages", renderPath: "p/contribute" },
  { label: "Links", packagePath: "gno.land/r/gnoland/pages", renderPath: "p/links" },
  { label: "Events", packagePath: "gno.land/r/devrels/events" },
  { label: "Partners", packagePath: "gno.land/r/gnoland/pages", renderPath: "p/partners" },
];
