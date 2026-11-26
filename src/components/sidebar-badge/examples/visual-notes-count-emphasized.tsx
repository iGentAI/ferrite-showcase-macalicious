import { SidebarBadge } from "macalicious/sidebar-badge";

/**
 * Visual comparison target: the plain count “5” at the end of the selected folder row of
 * Notes, Dark Aqua, where the selection has the accent colour (`selected emphasized`).
 * Reference crop (2x pixels) x=440 y=206 w=52 h=40, i.e. 26 x 20 pt of the row's highlight
 * (#0772ec); the digit's ink spans x=454..465 in the capture. The digit is set in the fallback
 * font off Apple platforms.
 */
export default function VisualNotesCountEmphasized() {
  return (
    <div style={{ position: "relative", width: 26, height: 20, background: "#0772ec" }}>
      <SidebarBadge
        variant="plain"
        selected
        emphasized
        style={{ position: "absolute", right: 12, top: 2.5 }}
      >
        5
      </SidebarBadge>
    </div>
  );
}
