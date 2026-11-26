import { GestureOptionRow } from "macalicious/gesture-option-row";

/**
 * Fixture for what no screenshot shows: a highlighted row that is off above a row that is on
 * and not highlighted. 321 x 110 pt of the tab view's box (#e3e3e3, #363637); the callout is
 * the 311 x 53 pt shape at 5,3.5, its point at 316,30; the second row starts at y 55.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 321,
        height: 110,
        padding: 5,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <GestureOptionRow title="Secondary click" detail="Click on right side" highlighted />
      <GestureOptionRow title="Smart zoom" detail="Double-tap with one finger" defaultChecked />
    </div>
  );
}
