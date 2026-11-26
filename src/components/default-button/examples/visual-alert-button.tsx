import { DefaultButton } from "macalicious/default-button";

/**
 * Visual comparison target: the "Empty Trash" default button of Finder's alert, on the window
 * background (#ececec in Aqua, #303031 in Dark Aqua).
 *
 * Reference crop (2x pixels) x=674 y=292 w=248 h=60, i.e. 124 x 30 pt. The bezel's edges are at
 * x 685 to 910 and y 301 to 340, so its alignment box is 114 pt wide and starts 5 pt from the
 * crop's left edge and 4 pt from its top.
 */
export default function VisualAlertButton() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 124,
        height: 30,
        padding: "4px 0 0 5px",
        background: "light-dark(#ececec, #303031)",
      }}
    >
      <DefaultButton keyEquivalent="none" style={{ width: 114 }}>
        Empty Trash
      </DefaultButton>
    </div>
  );
}
