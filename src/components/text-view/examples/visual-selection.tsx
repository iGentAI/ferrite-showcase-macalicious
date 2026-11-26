import { TextView } from "macalicious/text-view";

/**
 * Fixture for the pixel checks in `text-view.visual.json`: the fill, selected text and the
 * selection of a window that is not key. 120 x 32 pt; the text is spaces, so that a selection
 * is a plain rectangle of the highlight colour: 16 pt high, from the 5 pt padding.
 */
export default function VisualSelection() {
  return (
    <div style={{ width: 120, height: 32 }}>
      <TextView id="view" aria-label="Text" defaultValue={" ".repeat(12)} spellCheck={false} />
    </div>
  );
}
