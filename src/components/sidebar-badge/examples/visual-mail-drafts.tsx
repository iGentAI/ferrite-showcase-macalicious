import { SidebarBadge } from "macalicious/sidebar-badge";
import type { CSSProperties } from "react";

/**
 * Visual comparison target: the “1” pill on the Drafts row of Mail's sidebar. Mail's window
 * is inactive in both captures, so the sidebar is its flat inactive colour (#f6f6f6 in Aqua,
 * #2c2d2f in Dark Aqua) and the example sets the knock-out colour to match. Reference crop
 * (2x pixels) w=64 h=40, i.e. 32 x 20 pt, with the pill 4 pt from the left and 2 pt from
 * the top: x=372 y=300 in Aqua, x=360 y=298 in Dark Aqua.
 */
export default function VisualMailDrafts() {
  return (
    <div
      style={
        {
          boxSizing: "border-box",
          width: 32,
          height: 20,
          padding: "2px 0 0 4px",
          background: "light-dark(#f6f6f6, #2c2d2f)",
          "--mac-sidebar-badge-knockout": "light-dark(#f6f6f6, #2c2d2f)",
        } as CSSProperties
      }
    >
      <SidebarBadge style={{ display: "flex", width: 24 }}>1</SidebarBadge>
    </div>
  );
}
