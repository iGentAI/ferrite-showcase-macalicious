import { StatusDot } from "macalicious/status-dot";

/**
 * Visual comparison target: the status column of the service list in System Preferences ›
 * Network. Reference crop (2x pixels) x=160 y=300 w=36 h=120, i.e. 18 x 60 pt: a green dot at
 * (4, 4) pt and a red dot at (4, 46) pt. The green dot's row is selected in a list without
 * keyboard focus (#dcdcdc in Aqua, #464646 in Dark Aqua) down to 30 pt; below it is the list
 * background.
 */
export default function VisualNetworkList() {
  return (
    <div
      style={{
        position: "relative",
        width: 18,
        height: 60,
        background: "light-dark(#ffffff, #1d1e1f)",
      }}
    >
      <div style={{ height: 30, background: "light-dark(#dcdcdc, #464646)" }} />
      <StatusDot status="available" style={{ position: "absolute", left: 4, top: 4 }} />
      <StatusDot status="unavailable" style={{ position: "absolute", left: 4, top: 46 }} />
    </div>
  );
}
