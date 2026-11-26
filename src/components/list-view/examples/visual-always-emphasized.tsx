import { ListView, ListViewRowTrailing } from "macalicious/list-view";

const names = ["Apple Inc.", "Stephen Hackett"];

// The square after each name is drawn in the row's text colour, so that a pixel check can read
// that colour where the fallback font's glyphs cannot be relied on.
const renderRow = (index: number) => (
  <>
    {names[index]}
    <ListViewRowTrailing>
      <span style={{ width: 8, height: 8, background: "currentColor" }} />
    </ListViewRowTrailing>
  </>
);

/**
 * State check target: a list whose selection is always emphasised, as the conversation list of
 * Messages. 188 x 72 pt, two 24 pt rows with the second selected and 24 pt below them. Nothing
 * is clicked: the comparisons read the selection while the list does not have the keyboard,
 * and in a window that is not active.
 */
export default function VisualAlwaysEmphasized() {
  return (
    <ListView
      aria-label="Conversations"
      emphasis="always"
      count={names.length}
      defaultValue={[1]}
      renderRow={renderRow}
      style={{ width: 188, height: 72, background: "light-dark(#ffffff, #1e1f20)" }}
    />
  );
}
