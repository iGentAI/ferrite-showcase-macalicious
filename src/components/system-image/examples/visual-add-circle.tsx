import { SystemImage } from "macalicious/system-image";

/**
 * Visual comparison target: the disc of the Add List button at the bottom of Reminders'
 * sidebar.
 *
 * Reference crop (2x pixels) x=142 y=1264 w=36 h=36, that is 18 x 18 pt of the sidebar's
 * material (#e7e7e6, Dark Aqua #2c2d2e), the 16 pt disc 1 pt from the crop's left and top (x
 * 144..175, y 1266..1297). Reminders draws it in #686867 (Dark Aqua #a8a9aa).
 */
export default function VisualAddCircle() {
  return (
    <div
      style={{
        position: "relative",
        width: 18,
        height: 18,
        color: "light-dark(#686867, #a8a9aa)",
        background: "light-dark(#e7e7e6, #2c2d2e)",
      }}
    >
      <SystemImage name="add-circle" style={{ position: "absolute", left: 1, top: 1 }} />
    </div>
  );
}
