import { DisclosureTriangle } from "macalicious/disclosure-triangle";

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, disabled, a
 * window that is not key) and for the turn on a real click. `disclosure-triangle.visual.json`
 * puts it into each state with real input and checks the pixels the spec expects.
 *
 * 54 x 29 pt: 8 pt of page on every side, so the focus ring is inside the capture. The first
 * triangle's 13 pt frame is x 8 to 21, the disabled one's x 33 to 46, both y 8 to 21. Collapsed,
 * the ink spans x 11 to 18.5 and y 10 to 19 of the capture; expanded, x 10 to 19 and y 11 to
 * 18.5.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", gap: 12, padding: 8 }}>
      <DisclosureTriangle id="triangle" aria-label="Show details" />
      <DisclosureTriangle aria-label="Show details, disabled" disabled />
    </div>
  );
}
