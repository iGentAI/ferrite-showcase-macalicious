import { Stepper } from "macalicious/stepper";

/**
 * Fixture for the states no reference screenshot shows (a pressed half, keyboard focus, a
 * window that is not key, another accent). `stepper.visual.json` puts it into each state with
 * real input and checks the pixels it expects.
 *
 * 29 x 38 pt: 8 pt of window background on every side, so the focus ring is inside the
 * capture. The stepper's box is x 8 to 21, y 8 to 30; its bezel is inset by half a point and
 * the fill by another half, and the two halves meet at y 19.
 */
export default function VisualStates() {
  return (
    <div style={{ padding: 8, lineHeight: 0, background: "light-dark(#ececec, #2f3032)" }}>
      <Stepper aria-label="Value" defaultValue={5} />
    </div>
  );
}
