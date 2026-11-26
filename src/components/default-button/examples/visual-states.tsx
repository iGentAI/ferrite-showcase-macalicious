import { DefaultButton } from "macalicious/default-button";

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, disabled, a
 * window that is not key). `default-button.visual.json` puts it into each state with real input
 * and checks the pixels the spec expects.
 *
 * 196 x 37 pt: 8 pt of page on every side, so the focus ring is inside the capture. The first
 * button's box is x 8 to 92, the disabled one's x 104 to 188, both y 8 to 29; each bezel is
 * inset by half a point and its fill by another half.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", gap: 12, padding: 8 }}>
      <DefaultButton id="default" style={{ width: 84 }}>
        Go
      </DefaultButton>
      <DefaultButton disabled style={{ width: 84 }}>
        Go
      </DefaultButton>
    </div>
  );
}
