import { HelpButton } from "macalicious/help-button";

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, disabled, a
 * window that is not key). `help-button.visual.json` puts it into each state with real input
 * and checks the pixels the spec expects.
 *
 * 70 x 37 pt: 8 pt of page on every side, so the focus ring is inside the capture. The first
 * button's box is x 8 to 29, the disabled one's x 41 to 62, both y 8 to 29; each bezel is inset
 * by half a point and its fill by another half.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", gap: 12, padding: 8 }}>
      <HelpButton id="help" />
      <HelpButton label="Help, disabled" disabled />
    </div>
  );
}
