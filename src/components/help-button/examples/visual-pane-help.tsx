import { HelpButton } from "macalicious/help-button";

/**
 * Visual comparison target: the help button of the Bluetooth preference pane, on the window
 * background (#ececec in Aqua, #303031 in Dark Aqua).
 *
 * Reference crop (2x pixels) x=1362 y=848 w=62 h=62, i.e. 31 x 31 pt. The circle's edge spans
 * x 1373 to 1412 and y 859 to 898, so its 21 pt alignment box starts 5 pt from the crop's left
 * edge and 5 pt from its top.
 */
export default function VisualPaneHelp() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 31,
        height: 31,
        padding: "5px 0 0 5px",
        background: "light-dark(#ececec, #303031)",
      }}
    >
      <HelpButton style={{ display: "flex" }} />
    </div>
  );
}
