import { Notes } from "../notes";
import { defaultNotes } from "../notes-data";

// The dark capture was taken a day later: the first note's date reads "Yesterday".
const notes = defaultNotes.map((note, index) =>
  index === 0 ? { ...note, date: "Yesterday" } : note,
);

/**
 * Visual comparison target: the whole of 10-15-Catalina-Dark-Notes.png, 1112 x 778 pt, with
 * the window at (56, 38) over a white matte. The comparison clicks the folder first, as in
 * the capture: the folder list has the focus, so its selection is accent-coloured and Delete,
 * which would act on the folder every account has, is dimmed.
 */
export default function VisualWindowDark() {
  return (
    <div style={{ width: 1112, height: 778, background: "white", position: "relative" }}>
      <Notes defaultNotes={notes} style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
