import { SearchField } from "macalicious/search-field";

/**
 * Fixture for the states no reference screenshot shows (the standard field, focus on it, the
 * cancel button, a window that is not key). `search-field.visual.json` puts it into each
 * state with real input and checks the pixels it expects.
 *
 * 176 x 38 pt: 8 pt of page on every side, so the focus ring is inside the capture. The
 * field's edge is x 8 to 168 and y 8 to 30.
 */
export default function VisualStates() {
  return (
    <div style={{ padding: 8, lineHeight: 0 }}>
      <SearchField id="standard" style={{ width: 160 }} />
    </div>
  );
}
