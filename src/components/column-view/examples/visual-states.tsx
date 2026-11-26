import { ColumnView, type ColumnViewItem } from "macalicious/column-view";

const folders: Record<string, ColumnViewItem[]> = {
  root: [
    { id: "alpha", label: "Alpha", hasChildren: true },
    { id: "beta", label: "Beta" },
  ],
  alpha: [
    { id: "one", label: "One" },
    { id: "two", label: "Two" },
  ],
};
const getChildren = (id: string | number | null) => folders[id ?? "root"];

/**
 * Visual check target for the states no screenshot shows: a 240 x 60 pt view of two 100 pt
 * columns without icons, "Alpha" selected in the first and "One" in the second. The
 * comparisons click, press keys and move focus, then read pixels.
 */
export default function VisualStates() {
  return (
    <ColumnView
      aria-label="States"
      getChildren={getChildren}
      defaultPath={["alpha", "one"]}
      columnWidth={100}
      style={{ width: 240, height: 60 }}
    />
  );
}
