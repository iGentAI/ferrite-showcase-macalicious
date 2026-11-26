import { GradientButton, GradientButtonGroup } from "macalicious/gradient-button";

/**
 * Fixture for the states no reference screenshot shows (pressed, on, keyboard focus, a window
 * that is not key). `gradient-button.visual.json` puts it into each state with real input and
 * checks the pixels the spec expects.
 *
 * 89 x 37 pt: 8 pt of page on every side, so the focus ring is inside the capture. Three 25 pt
 * cells that share their borders: add (x 8 to 33), a button that is on (x 32 to 57) and a
 * disabled remove (x 56 to 81), all y 8 to 29 with a 1 pt border.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", padding: 8 }}>
      <GradientButtonGroup>
        <GradientButton id="add" glyph="add" aria-label="Add" />
        <GradientButton glyph="remove" aria-label="Compact" aria-pressed />
        <GradientButton glyph="remove" aria-label="Remove" disabled />
      </GradientButtonGroup>
    </div>
  );
}
