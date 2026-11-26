import { StickyNote, StickyNoteText, StickyNoteTitleBar } from "macalicious/sticky-note";

const TEXT = `

Stickies lets you keep notes (like these) on your desktop. Use a Stickies note to jot down reminders, lists, or other information. You can also use notes to store frequently used text or graphics.

• To close this note, click the close button.

• To collapse this note, double click the title bar.

Your current notes appear when you open Stickies.
`;

/**
 * Visual comparison target: the yellow note of the Stickies screenshots, whole.
 *
 * Reference crop (2x pixels) x=138 y=606 w=704 h=520: the note's own 352 x 260 pt, without its
 * shadow. In the Aqua capture Stickies is frontmost and the note is key (title strip and
 * widgets); in the Dark Aqua capture Finder is frontmost, so the comparison renders it in an
 * inactive window and the strip is gone.
 *
 * Off Apple platforms the text is set in a stand-in for Helvetica (Nimbus Sans, Arimo), whose
 * baseline lies half a point lower in a 14 pt line than Helvetica's. The example takes that
 * half point off the padding above the text; an application does not.
 */
export default function VisualNote() {
  return (
    <div style={{ width: 352, height: 260 }}>
      <StickyNote aria-label="Make a note of it!" style={{ height: "100%" }}>
        <StickyNoteTitleBar>Make a note of it!</StickyNoteTitleBar>
        <StickyNoteText style={{ paddingTop: 6.5 }}>
          <b>Make a note of it!</b>
          {TEXT}
        </StickyNoteText>
      </StickyNote>
    </div>
  );
}
