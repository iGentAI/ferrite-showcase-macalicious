import { StickyNote, StickyNoteText, StickyNoteTitleBar } from "macalicious/sticky-note";

/**
 * Fixture for what no screenshot shows: a blue note as the key note (its strip and widgets)
 * and, directly under it, a yellow note collapsed to its 12 pt title bar although it was given
 * 40 pt of height and a minimum height of 30 pt. The column is 100 x 52 pt.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 100 }}>
      <StickyNote color="blue" aria-label="Blue note" style={{ height: 40 }}>
        <StickyNoteTitleBar />
        <StickyNoteText aria-label="Blue note text" />
      </StickyNote>
      <StickyNote
        defaultCollapsed
        aria-label="Collapsed note"
        style={{ height: 40, minHeight: 30 }}
      >
        <StickyNoteTitleBar />
        <StickyNoteText aria-label="Collapsed note text" />
      </StickyNote>
    </div>
  );
}
