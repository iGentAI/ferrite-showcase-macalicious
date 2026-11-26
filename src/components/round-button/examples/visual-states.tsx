import { RoundButton } from "macalicious/round-button";
import { SystemImage } from "macalicious/system-image";

/* The `add` system image at 7 pt, so that it also fits the mini bezel. */
function Plus() {
  return <SystemImage name="add" scale={7 / 11} />;
}

/**
 * Fixture for the round button, which no reference screenshot shows. `round-button.visual.json`
 * puts it into each state with real input and checks the pixels the spec expects.
 *
 * 127 x 37 pt: 8 pt of page on every side, so the focus ring is inside the capture. From the
 * left: a regular button (box x 8 to 29, y 8 to 29), a disabled one (x 41 to 62), a small one
 * (x 74 to 92, y 8 to 26) and a mini one (x 104 to 119, y 8 to 23). Each bezel is inset by half
 * a point and its fill by another half.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 8 }}>
      <RoundButton id="round" aria-label="Add">
        <Plus />
      </RoundButton>
      <RoundButton aria-label="Add, disabled" disabled>
        <Plus />
      </RoundButton>
      <RoundButton size="small" aria-label="Add, small">
        <Plus />
      </RoundButton>
      <RoundButton size="mini" aria-label="Add, mini">
        <Plus />
      </RoundButton>
    </div>
  );
}
