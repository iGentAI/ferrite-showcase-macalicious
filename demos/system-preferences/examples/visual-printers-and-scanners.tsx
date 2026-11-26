import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Printers & Scanners pane, 668 x 438 pt, in the state both
 * captures show.
 *
 * Reference crop x=112 y=76 w=1336 h=876: the opaque frame without its shadow.
 */
export default function VisualPrintersAndScanners() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 438,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="printers-and-scanners" />
    </div>
  );
}
