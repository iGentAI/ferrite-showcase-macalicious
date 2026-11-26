import {
  MissionControl,
  MissionControlSpace,
  MissionControlWindow,
} from "macalicious/mission-control";
import { type CSSProperties, useState } from "react";

/**
 * State check target: Mission Control on a 1680 by 1050 point desktop painted a flat mid
 * grey, #808080, with one space and two windows of the sizes the captures show: 999 by 690
 * (Maps) and 668 by 554 (System Preferences), which overlap on the desktop.
 *
 * Over a flat grey the Spaces bar's material can be computed: blur and saturation leave the
 * grey as it is and the tint lightens or darkens it. The windows are flat stand-ins, #404040
 * and #c0c0c0, without shadows, so that the edges of the thumbnails can be read: side by side
 * they need 999 + 12 + 668 points and the area is 1644 wide, so they are shown at 97.9%, as
 * in the captures (978 and 654 points wide, 18 points from the sides, 12 apart).
 */
export default function VisualWindows() {
  const [desktop, setDesktop] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setDesktop}
      style={
        {
          position: "relative",
          width: 1680,
          height: 1050,
          background: "#808080",
          "--mac-mission-control-desktop": "#808080",
          "--mac-mission-control-window-shadow": "none",
        } as CSSProperties
      }
    >
      <MissionControl
        defaultOpen
        container={desktop}
        spaces={
          <MissionControlSpace label="Desktop 1" current>
            <span style={{ background: "#606060" }} />
          </MissionControlSpace>
        }
      >
        <MissionControlWindow
          title="System Preferences"
          frame={{ x: 900, y: 320, width: 668, height: 554 }}
        >
          <div style={{ height: "100%", background: "#c0c0c0" }} />
        </MissionControlWindow>
        <MissionControlWindow title="Maps" frame={{ x: 20, y: 93, width: 999, height: 690 }}>
          <div style={{ height: "100%", background: "#404040" }} />
        </MissionControlWindow>
      </MissionControl>
    </div>
  );
}
