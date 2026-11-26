import { StickyNote, StickyNoteText, StickyNoteTitleBar } from "macalicious/sticky-note";

/**
 * Visual comparison target: the top edge of the yellow note where it lies over the blue note,
 * the one place where what is behind a note is a flat colour, so the shadow and the Dark Aqua
 * outline can be compared.
 *
 * Reference crop (2x pixels) x=470 y=586 w=330 h=54, that is 165 x 27 pt: 10 pt of the blue
 * note (#aef4ff), the 12 pt title band and 5 pt of the body. The yellow note's left edge is
 * 166 pt left of the crop and its zoom box is inside it (x 154 to 162 pt).
 */
export default function VisualTopEdge() {
  return (
    <div
      style={{
        position: "relative",
        width: 165,
        height: 27,
        overflow: "hidden",
        background: "#aef4ff",
      }}
    >
      <StickyNote
        aria-label="Make a note of it!"
        style={{ position: "absolute", left: -166, top: 10, width: 352, height: 260 }}
      >
        <StickyNoteTitleBar />
        <StickyNoteText />
      </StickyNote>
    </div>
  );
}
