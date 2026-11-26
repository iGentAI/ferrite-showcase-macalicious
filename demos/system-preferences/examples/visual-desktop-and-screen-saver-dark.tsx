import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Desktop & Screen Saver pane, 668 x 562 pt, as the Dark Aqua
 * capture shows it: the Catalina dynamic desktop on its dark still, which has no sentence under
 * the pop-up button.
 *
 * Reference crop x=112 y=76 w=1336 h=1124: the opaque frame without its shadow.
 */
export default function VisualDesktopAndScreenSaverDark() {
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
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="desktop-and-screen-saver"
        defaultSettings={{ "desktop-and-screen-saver.mode": "dark" }}
      />
    </div>
  );
}
