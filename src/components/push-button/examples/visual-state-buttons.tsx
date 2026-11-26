import { PushButton } from "macalicious/push-button";

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, a window that
 * is not key, another accent). `push-button.visual.json` puts it into each state with real
 * input and checks the pixels it expects.
 *
 * 196 x 37 pt: 8 pt of page on every side, so the focus ring is inside the capture. The
 * standard button's box is x 8 to 92, the primary button's x 104 to 188, both y 8 to 29; each
 * bezel is inset by half a point and its fill by another half.
 */
export default function VisualStateButtons() {
  return (
    <div style={{ display: "flex", gap: 12, padding: 8 }}>
      <PushButton id="standard" style={{ width: 84 }}>
        Cancel
      </PushButton>
      <PushButton id="primary" variant="primary" style={{ width: 84 }}>
        Go
      </PushButton>
    </div>
  );
}
