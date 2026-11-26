import { StatusBar } from "macalicious/status-bar";

/** An original stand-in for the application's computer icon: a display on a base. */
function ComputerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="7" rx="1" fill="none" stroke="currentColor" />
      <path d="M1 12.5h14" stroke="currentColor" />
    </svg>
  );
}

/**
 * Visual comparison target: the breadcrumb strip at the bottom of System Information.
 *
 * Reference crop (2x pixels) x=114 y=1074 w=1400 h=40, i.e. 700 x 20 pt. The strip starts at
 * the window edge, one point left of the crop (the dark window's inner border is there), and is
 * 21 pt high; its last point is under that border too. The icon is the application's artwork
 * and is replaced by a stand-in.
 */
export default function VisualSystemInformation() {
  return (
    <div style={{ width: 700, height: 20, overflow: "hidden" }}>
      <StatusBar
        variant="breadcrumb"
        style={{ marginLeft: -1 }}
        leading={
          <>
            <ComputerIcon />
            <span>ismh15 › Hardware</span>
          </>
        }
      />
    </div>
  );
}
