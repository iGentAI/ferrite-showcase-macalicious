import { StatusDot } from "macalicious/status-dot";

/**
 * Visual comparison target: the 10 pt dot before “File Sharing: On” in System Preferences ›
 * Sharing, on the pane's band. Reference crop (2x pixels) x=576 y=382 w=40 h=40, i.e.
 * 20 x 20 pt with the dot (x=586..605, y=392..411 in both captures) at (5, 5) pt.
 */
export default function VisualSharingStatus() {
  return (
    <div
      style={{
        position: "relative",
        width: 20,
        height: 20,
        background: "light-dark(#e3e3e3, #353637)",
      }}
    >
      <StatusDot status="available" style={{ position: "absolute", left: 5, top: 5 }} />
    </div>
  );
}
