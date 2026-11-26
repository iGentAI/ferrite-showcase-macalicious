import { DefaultButton } from "macalicious/default-button";

/**
 * Visual comparison target: the "Next" default button of the Family Sharing preference pane,
 * inside a box (#e3e3e3 in Aqua, #363637 in Dark Aqua).
 *
 * Reference crop (2x pixels) x=1284 y=642 w=134 h=60, i.e. 67 x 30 pt. The bezel's edges are at
 * x 1295 to 1406 and y 651 to 690, so its alignment box is 57 pt wide and starts 5 pt from the
 * crop's left edge and 4 pt from its top.
 */
export default function VisualPaneButton() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 67,
        height: 30,
        padding: "4px 0 0 5px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <DefaultButton keyEquivalent="none" style={{ width: 57 }}>
        Next
      </DefaultButton>
    </div>
  );
}
