import { WindowShadow } from "macalicious/window-shadow";

/**
 * Visual comparison target: the smaller shadow under a utility panel (Help Viewer).
 *
 * Reference crop x=400 y=1482 w=600 h=54 (300 x 27 pt): the transparent margin under the
 * panel, matted with white.
 */
export default function VisualPanelBottom() {
  return (
    <div
      style={{
        position: "relative",
        width: 300,
        height: 27,
        overflow: "hidden",
        background: "white",
      }}
    >
      <WindowShadow
        level="panel"
        style={{ position: "absolute", left: -177, bottom: 27, width: 877, height: 722 }}
      />
    </div>
  );
}
