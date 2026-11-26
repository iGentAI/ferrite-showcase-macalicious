import { ColumnView, type ColumnViewItem } from "macalicious/column-view";
import type { CSSProperties } from "react";

const blocks = "\u2588\u2588\u2588\u2588";
const folders: Record<string, ColumnViewItem[]> = {
  root: [
    { id: "alpha", label: blocks, hasChildren: true },
    { id: "beta", label: blocks },
  ],
  alpha: [
    { id: "one", label: blocks, hasChildren: true },
    { id: "two", label: blocks, hasChildren: true },
  ],
  one: [],
  two: [],
};
const getChildren = (id: string | number | null) => folders[id ?? "root"];

/**
 * Visual check target for forced colours: a 320 x 60 pt view, wide enough for three 100 pt
 * columns, whose names are runs of full blocks, so that a pixel of the text can be read
 * whatever the font, with the first item of the first column selected. The colours of text and of the triangle
 * on an emphasised selection are given a marker value (red): in forced colours a selected
 * row must not show it, in the focused column or in the one before it, because its text and
 * triangle are the system's highlight text.
 */
export default function VisualForcedColors() {
  return (
    <ColumnView
      aria-label="Forced colours"
      getChildren={getChildren}
      defaultPath={["alpha"]}
      columnWidth={100}
      style={
        {
          width: 320,
          height: 60,
          "--mac-color-selected-content-text": "#ff0000",
          "--mac-column-view-arrow-emphasized": "#ff0000",
        } as CSSProperties
      }
    />
  );
}
