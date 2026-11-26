import { StickyNote, StickyNoteText, StickyNoteTitleBar } from "macalicious/sticky-note";

export default function Basic() {
  return (
    <div style={{ padding: 16 }}>
      <StickyNote aria-label="Make a note of it!" style={{ width: 240, height: 120 }}>
        <StickyNoteTitleBar>Make a note of it!</StickyNoteTitleBar>
        <StickyNoteText>
          <b>Make a note of it!</b>
          {"\n\nStickies lets you keep notes (like these) on your desktop."}
        </StickyNoteText>
      </StickyNote>
    </div>
  );
}
