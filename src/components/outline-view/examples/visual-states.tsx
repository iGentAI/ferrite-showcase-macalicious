import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";

const items: OutlineViewItem[] = [
  { id: "a", children: [{ id: "a1", children: [{ id: "a1x" }] }, { id: "a2" }] },
  { id: "b", children: [{ id: "b1" }] },
];

/**
 * Visual check target for the states no screenshot shows: a 120 x 100 pt outline of 20 pt
 * rows without text. "a" holds "a1" (which holds "a1x") and "a2"; "b" holds "b1". All are
 * collapsed at first. The comparisons click triangles and use the arrow keys.
 */
export default function VisualStates() {
  return (
    <OutlineView
      aria-label="States"
      items={items}
      renderCell={() => null}
      rowHeight={20}
      style={{ width: 120, height: 100 }}
    />
  );
}
