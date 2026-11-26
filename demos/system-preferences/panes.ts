import type { PreferencePane } from "./pane";

/*
 * Every pane folder registers itself by existing: `panes/<id>/pane.tsx` exports `pane`. No list
 * is kept by hand, so two people adding panes never edit the same file (panes/README.md).
 */
const modules = import.meta.glob<{ pane: PreferencePane }>("./panes/*/pane.tsx", { eager: true });

/** The panes that are built, by id (the folder name). */
export const PANES: ReadonlyMap<string, PreferencePane> = new Map(
  Object.entries(modules).map(([file, module]) => [file.split("/").at(-2) ?? file, module.pane]),
);
