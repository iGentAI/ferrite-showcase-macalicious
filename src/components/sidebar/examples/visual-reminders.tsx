import { Sidebar, SidebarItem } from "macalicious/sidebar";
import type { CSSProperties } from "react";

// Reminders' rows touch, their 22 pt disc starts 20 pt from the pane's edge, the label follows
// 9.5 pt after it and the count ends 11 pt before the divider.
const row = { marginBlockEnd: 0, paddingInline: "20px 11px", gap: 9.5 } as const;

// Stand-in for a list's badge: the disc alone, in the list's colour. It fills the row's icon
// box, so its size is the one `--mac-sidebar-icon-size` gives.
const disc = (color: string) => (
  <span
    aria-hidden="true"
    style={{ width: "100%", height: "100%", borderRadius: "50%", background: color }}
  />
);

/**
 * Visual comparison target: the three “My Lists” rows of the Reminders sidebar, the last one
 * selected while the list does not have the focus.
 *
 * Reference crop (2x pixels) x=114 y=572 w=556 h=216 of Light- and Dark-Reminders, i.e. 278 x
 * 108 pt: three 36 pt rows, without the first and last point of the 280 pt pane. The rows are
 * 36 pt high with 22 pt discs, set with `--mac-sidebar-row-height` and
 * `--mac-sidebar-icon-size`; the selection runs from y 716 to 787. The discs' glyphs are
 * Apple artwork and the text is in the fallback font: both are masked.
 */
export default function VisualReminders() {
  return (
    <div style={{ width: 278, height: 108, overflow: "hidden" }}>
      <Sidebar
        aria-label="My Lists"
        material="opaque"
        value="imac"
        style={
          {
            width: 280,
            height: 118,
            margin: "-5px 0 0 -1px",
            "--mac-sidebar-row-height": "36px",
            "--mac-sidebar-icon-size": "22px",
          } as CSSProperties
        }
      >
        <SidebarItem
          value="reminders"
          label="Reminders"
          icon={disc("#007aff")}
          accessory="0"
          style={row}
        />
        <SidebarItem value="work" label="Work" icon={disc("#008000")} accessory="5" style={row} />
        <SidebarItem
          value="imac"
          label="iMac Colors"
          icon={disc("#007aff")}
          accessory="13"
          style={row}
        />
      </Sidebar>
    </div>
  );
}
