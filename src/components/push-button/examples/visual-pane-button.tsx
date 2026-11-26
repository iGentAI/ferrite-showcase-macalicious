import { PushButton } from "macalicious/push-button";

/**
 * Visual comparison target: the "Advanced…" button of the Bluetooth preference pane, a regular
 * push button at its natural place on the window background.
 *
 * Reference crop (2x pixels) x=1140 y=850 w=218 h=58, i.e. 109 x 29 pt. The bezel's edges are at
 * x 1151 to 1346 and y 859 to 898, so its alignment box is 99 pt wide and starts 5 pt from the
 * crop's left edge and 4 pt from its top.
 */
export default function VisualPaneButton() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 109,
        height: 29,
        padding: "4px 0 0 5px",
        background: "light-dark(#ececec, #303031)",
      }}
    >
      <PushButton style={{ width: 99 }}>Advanced…</PushButton>
    </div>
  );
}
