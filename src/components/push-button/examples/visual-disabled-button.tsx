import { PushButton } from "macalicious/push-button";

/**
 * Visual comparison target: the disabled "Restore Defaults" button of the Energy Saver
 * preference pane, inside a box (#e3e3e3 in Aqua, #363637 in Dark Aqua).
 *
 * Reference crop (2x pixels) x=1108 y=898 w=284 h=60, i.e. 142 x 30 pt. The bezel's edges are at
 * x 1119 to 1380 and y 907 to 946, so its alignment box is 132 pt wide and starts 5 pt from the
 * crop's left edge and 4 pt from its top.
 */
export default function VisualDisabledButton() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 142,
        height: 30,
        padding: "4px 0 0 5px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <PushButton disabled style={{ width: 132 }}>
        Restore Defaults
      </PushButton>
    </div>
  );
}
