import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the General pane as it finds the page, 668 x 678 pt. Nothing is
 * preset, so the pane shows the appearance and the accent colour the page has: the comparison
 * sets them (`appearance`, `accent`) to those of one of the Theme screenshots.
 *
 * Reference crop x=978 y=324 w=1336 h=1356 of a Theme screenshot: the window's opaque frame on
 * the desktop.
 */
export default function VisualGeneralTheme() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 678,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="general" />
    </div>
  );
}
