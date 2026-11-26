import { StickyNote, StickyNoteText, StickyNoteTitleBar } from "macalicious/sticky-note";

const COLORS = ["yellow", "blue", "green", "pink", "purple", "gray"] as const;

/** The six colours of Stickies' Color menu, each as the key note so its title strip shows. */
export default function Colors() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: 16 }}>
      {COLORS.map((color) => (
        <StickyNote
          key={color}
          color={color}
          aria-label={`${color} note`}
          style={{ width: 120, height: 72 }}
        >
          <StickyNoteTitleBar>{color}</StickyNoteTitleBar>
          <StickyNoteText readOnly aria-label={`${color} note text`}>
            {color}
          </StickyNoteText>
        </StickyNote>
      ))}
    </div>
  );
}
