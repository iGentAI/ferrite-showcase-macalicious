import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Software Update pane, 668 x 285 pt, in the state the Aqua
 * capture shows: up to date, last checked at 10:47, the checkbox mixed.
 *
 * Reference crop x=112 y=76 w=1336 h=570: the opaque frame without its shadow.
 */
export default function VisualSoftwareUpdate() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 285,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="software-update" />
    </div>
  );
}
