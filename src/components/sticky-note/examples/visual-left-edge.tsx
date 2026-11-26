import { StickyNote, StickyNoteText, StickyNoteTitleBar } from "macalicious/sticky-note";

/**
 * Visual comparison target: the left edge of the yellow note over the blue note, between two
 * lines of the blue note's text.
 *
 * Reference crop (2x pixels) x=118 y=624 w=40 h=24, that is 20 x 12 pt: 10 pt of the blue note
 * (#aef4ff) and 10 pt of the yellow note, whose top is 9 pt above the crop.
 */
export default function VisualLeftEdge() {
  return (
    <div
      style={{
        position: "relative",
        width: 20,
        height: 12,
        overflow: "hidden",
        background: "#aef4ff",
      }}
    >
      <StickyNote
        aria-label="Make a note of it!"
        style={{ position: "absolute", left: 10, top: -9, width: 352, height: 260 }}
      >
        <StickyNoteTitleBar />
        <StickyNoteText />
      </StickyNote>
    </div>
  );
}
