import { StickyNote, StickyNoteText, StickyNoteTitleBar } from "macalicious/sticky-note";

/**
 * The states of a note: key (title strip and widgets), not key (the band stays, in the note's
 * colour), collapsed to its title bar, and translucent.
 */
export default function States() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: 16 }}>
      <StickyNote aria-label="Key note" style={{ width: 130, height: 72 }}>
        <StickyNoteTitleBar>Key</StickyNoteTitleBar>
        <StickyNoteText aria-label="Key note text">Key</StickyNoteText>
      </StickyNote>
      <StickyNote
        state="inactive"
        aria-label="Note that is not key"
        style={{ width: 130, height: 72 }}
      >
        <StickyNoteTitleBar>Not key</StickyNoteTitleBar>
        <StickyNoteText aria-label="Text of the note that is not key">Not key</StickyNoteText>
      </StickyNote>
      <StickyNote defaultCollapsed aria-label="Collapsed note" style={{ width: 130, height: 72 }}>
        <StickyNoteTitleBar>Collapsed</StickyNoteTitleBar>
        <StickyNoteText aria-label="Collapsed note text">Collapsed</StickyNoteText>
      </StickyNote>
      <StickyNote translucent aria-label="Translucent note" style={{ width: 130, height: 72 }}>
        <StickyNoteTitleBar>Translucent</StickyNoteTitleBar>
        <StickyNoteText aria-label="Translucent note text">Translucent</StickyNoteText>
      </StickyNote>
    </div>
  );
}
