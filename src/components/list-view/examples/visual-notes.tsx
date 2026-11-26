import {
  ListView,
  ListViewRowDetail,
  ListViewRowTitle,
  ListViewRowTrailing,
} from "macalicious/list-view";
import type { CSSProperties } from "react";

const notes = [
  {
    title: "Catalina Notes is just like the old one",
    date: "3:55 PM",
    snippet: "View.",
    image: true,
  },
  { title: "All computers should be orange", date: "9/20/18", snippet: "It’s true." },
  {
    title: "Are these what the kids call selfies",
    date: "7/15/18",
    snippet: "1 photo",
    image: true,
  },
  { title: "This is a note in Yosemite", date: "7/14/18", snippet: "It’s kinda nice in here." },
  { title: "This is a note in Mavericks.", date: "6/13/18", snippet: "Here is an image:" },
];

const renderRow = (index: number) => {
  const note = notes[index];
  return (
    <>
      <ListViewRowTitle>{note?.title}</ListViewRowTitle>
      <ListViewRowDetail lead={note?.date}>{note?.snippet}</ListViewRowDetail>
      {note?.image && (
        <ListViewRowTrailing>
          {/* Stand-in for the note's thumbnail: 41 pt square with a hairline outline. */}
          <span
            style={{
              width: 41,
              height: 41,
              background: "#fcfcfb",
              boxShadow: "0 0 0 0.5px var(--mac-color-label-tertiary)",
            }}
          />
        </ListViewRowTrailing>
      )}
    </>
  );
};

/**
 * Visual comparison target: the note list of Notes, 10-15-Catalina-Light-Notes.png and
 * 10-15-Catalina-Dark-Notes.png. Reference crop (2x pixels) x=494 y=152 w=496 h=560, i.e.
 * the 248 pt wide list pane and its first five 56 pt rows; the first is selected and the
 * list does not have focus (grey selection).
 *
 * Notes paints its own colours, set here: the Aqua list has a paper noise texture, of which
 * the example paints the mean (#fafaf8, and #e1e1df under the selection); the Dark Aqua
 * selection is #343537. The thumbnails are stand-ins.
 */
export default function VisualNotes() {
  return (
    <ListView
      aria-label="Notes"
      count={notes.length}
      rowHeight={56}
      separator="inset"
      defaultValue={[0]}
      renderRow={renderRow}
      style={
        {
          width: 248,
          height: 280,
          background: "light-dark(#fafaf8, #1e1f21)",
          "--mac-list-view-selected-background": "light-dark(#e1e1df, #343537)",
        } as CSSProperties
      }
    />
  );
}
