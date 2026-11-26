import { Checkbox } from "macalicious/checkbox";

/**
 * Target of the state checks in checkbox.visual.json: an off and an on checkbox, pressed with
 * the mouse, focused with Tab or put in a window that is not key by the runner, which then
 * reads single pixels. No screenshot shows these states.
 *
 * 48 x 24 pt. The off box is at x 5..19, the on box at x 29..43, both at y 5..19, on the
 * untinted window background.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        boxSizing: "border-box",
        width: 48,
        height: 24,
        padding: 5,
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <Checkbox aria-label="Off" />
      <Checkbox defaultChecked aria-label="On" />
    </div>
  );
}
