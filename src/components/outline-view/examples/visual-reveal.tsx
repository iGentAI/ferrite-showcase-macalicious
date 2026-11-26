import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";
import { useState } from "react";

// Sixty items without text. Items 2 and 40 are the only parents, so their collapsed triangles
// tell where their rows are.
const items: OutlineViewItem[] = Array.from({ length: 60 }, (_, index) =>
  index === 2 || index === 40 ? { id: index, children: [] } : { id: index },
);

const COLUMNS = [{ id: "item", title: "Item" }];

/**
 * Visual check target for `revealedItem`, which no screenshot shows: a 120 x 84 pt outline, a
 * 24 pt header over three 20 pt rows of sixty. It opens with item 40 revealed, far below the
 * first rows, and selecting any row reveals item 2 instead, far above. The comparisons find
 * the two rows by their triangles: item 40 in the last row of the view and item 2 in the first
 * one under the header, which is as far as the outline has to scroll for each.
 */
export default function VisualReveal() {
  const [revealed, setRevealed] = useState(40);
  return (
    <OutlineView
      aria-label="Reveal"
      items={items}
      columns={COLUMNS}
      renderCell={() => null}
      rowHeight={20}
      revealedItem={revealed}
      onValueChange={() => setRevealed(2)}
      style={{ width: 120, height: 84 }}
    />
  );
}
