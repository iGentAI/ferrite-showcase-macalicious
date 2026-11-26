import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";

interface Entry extends OutlineViewItem {
  name: string;
}

const chapters: Entry[] = Array.from({ length: 12 }, (_, index) => ({
  id: `chapter-${index + 1}`,
  name: `Chapter ${index + 1}`,
  children: [1, 2, 3].map((section) => ({
    id: `section-${index + 1}.${section}`,
    name: `Section ${index + 1}.${section}`,
  })),
}));

/**
 * The outline opens on its last chapter. Each button names another item in `revealedItem`.
 * The second also expands the chapter its section is in, in the same update, because an item
 * inside a collapsed parent has no row to scroll to.
 */
export default function Reveal() {
  const [expanded, setExpanded] = useState<readonly (string | number)[]>([]);
  const [revealed, setRevealed] = useState("chapter-12");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
      <OutlineView
        aria-label="Contents"
        items={chapters}
        renderCell={(item) => item.name}
        getItemLabel={(item) => item.name}
        expanded={expanded}
        onExpandedChange={setExpanded}
        revealedItem={revealed}
        rowHeight={18}
        style={{ width: 220, height: 110 }}
      />
      <div style={{ display: "flex", gap: 12 }}>
        <PushButton onClick={() => setRevealed("chapter-1")}>Show Chapter 1</PushButton>
        <PushButton
          onClick={() => {
            setExpanded([...new Set([...expanded, "chapter-9"])]);
            setRevealed("section-9.2");
          }}
        >
          Show Section 9.2
        </PushButton>
      </div>
    </div>
  );
}
