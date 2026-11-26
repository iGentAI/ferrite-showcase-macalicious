import { Checkbox } from "macalicious/checkbox";

/**
 * Target of the size checks in checkbox.visual.json: a small and a mini checkbox, both on. No
 * screenshot shows either size, so the runner checks only that the boxes are 12 and 10 pt.
 *
 * 42 x 22 pt. The small box is at x 5..17, y 5..17; the mini box at x 27..37, y 5..15.
 */
export default function VisualSizes() {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        boxSizing: "border-box",
        width: 42,
        height: 22,
        padding: 5,
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <Checkbox size="small" defaultChecked aria-label="Small" />
      <Checkbox size="mini" defaultChecked aria-label="Mini" />
    </div>
  );
}
