import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Desktop & Screen Saver pane, 668 x 562 pt, as the Aqua capture
 * shows it: the Catalina dynamic desktop, Dynamic.
 *
 * Reference crop x=112 y=76 w=1336 h=1124: the opaque frame without its shadow.
 */
export default function VisualDesktopAndScreenSaver() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 562,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="desktop-and-screen-saver" />
    </div>
  );
}
