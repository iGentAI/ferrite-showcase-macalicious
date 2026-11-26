import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Startup Disk pane, 668 x 403 pt, locked, with the one volume
 * the Aqua capture shows.
 *
 * Reference crop x=112 y=76 w=1336 h=806: the opaque frame without its shadow.
 */
export default function VisualStartupDisk() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 403,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="startup-disk" />
    </div>
  );
}
