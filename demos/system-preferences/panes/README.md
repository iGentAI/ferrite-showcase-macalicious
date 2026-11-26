# Panes

One folder per pane of System Preferences. A folder registers itself by existing: the shell
finds `panes/<id>/pane.tsx` with `import.meta.glob` (`../panes.ts`). There is no registration
list to edit, so two people adding panes do not meet in one. (A pane's example, its visual
comparisons and its line on the docs page are outside its folder; see the last rule.)

```text
panes/dock/
  pane.tsx      export const pane = definePane({ height, component, keywords })
  dock.tsx      the pane's component (more files are fine)
  dock.css      optional: classes prefixed .mac-system-preferences-dock
```

```tsx
// panes/dock/pane.tsx
import { definePane } from "../../pane";
import { Dock } from "./dock";

export const pane = definePane({
  height: 401, // the whole window frame while the pane is open, title bar included
  component: Dock,
  keywords: ["magnification", "minimize"], // extra words for the toolbar's search field
  // title: "Built-in Retina Display",    // only when the window's title is not the pane's name
});
```

Rules:

- **The folder name is the pane's id** and must be one of the ids in `../catalogue.ts`, which
  already lists all thirty-three panes with their names and grid captions (the ids are the
  blueprint names: `reference/spec/apps/system-preferences-<id>.md`). The catalogue supplies
  the window title and the grid icon; a pane without a folder opens a placeholder. A test fails
  on a folder whose name is not in the catalogue.
- **The component takes no props.** It is rendered in a box 668 pt wide and `height - 38` pt
  high (38 pt is the title bar), on the pane background. The box is `position: relative`.
- **Lay out with the blueprint's coordinates.** A pane is a frame of fixed size, as in AppKit.
  `../form.tsx` has the helpers: `PaneForm` (fills the pane; `labelWidth` is where the
  right-aligned labels end, `gap` the space after them, and `origin` places a form that sits in
  a tab view), `PaneRow` (`y`, `label`, controls), `PaneAt` (anything at `x`, `y`), `PaneRule`
  (a separator 20 pt
  from each side) and `PaneFooter` (help and lock buttons). Every `y` is measured from the top
  of the window frame, exactly as the blueprints give it; the helpers subtract the title bar.
  Anything else is placed by the pane's own CSS.
- **Keep settings with `usePreference("<id>.<setting>", initial)`** from `../pane`, not
  `useState`, so they survive leaving the pane and coming back, and so an example can open the
  window in a given state with `defaultSettings`.
- **`usePreferences()`** gives `showPane(id)` to open another pane and `themeTarget`, the
  element the General pane themes.
- **Import only library entry points** (`macalicious/<name>`, `macalicious/lib/<name>`) and
  files of the demo. Do not restyle a library control; place it. No Apple artwork: draw a
  stand-in.
- **Compare it.** Add `examples/visual-<id>.tsx` (and `-dark` when the dark capture differs in
  content) next to the others in `../examples/`, opening the window with
  `defaultPane="<id>"`, and its comparisons to `../system-preferences.visual.json`. That file
  and the docs page `../system-preferences.mdx` are the two shared files a new pane adds lines
  to.
