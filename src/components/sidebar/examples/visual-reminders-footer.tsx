import { Sidebar, SidebarFooter, SidebarItem } from "macalicious/sidebar";

/**
 * Visual comparison target: “Add List” at the foot of the Reminders sidebar, whose glyph is a
 * filled disc with the plus cut out of it (`filled`).
 *
 * Reference crop (2x pixels) x=130 y=1250 w=280 h=72 of Light- and Dark-Reminders, i.e. 140 x
 * 36 pt, ending one point above the window's bottom edge and starting 9 pt inside the pane,
 * clear of the window's round corner. The glyph is at x 144 to 175, 16 pt from the pane's
 * edge, and its centre 20.5 pt above the window's bottom; the title follows 8 pt after it.
 * Those distances are Reminders' own and are set on the button; the title is masked.
 */
export default function VisualRemindersFooter() {
  return (
    <div style={{ position: "relative", width: 140, height: 36, overflow: "hidden" }}>
      <Sidebar
        aria-label="My Lists"
        material="opaque"
        style={{ position: "absolute", left: -9, bottom: -1, width: 280, height: 120 }}
        footer={
          <SidebarFooter filled style={{ height: 41, paddingInline: 16, gap: 8 }}>
            Add List
          </SidebarFooter>
        }
      >
        <SidebarItem value="work" label="Work" />
      </Sidebar>
    </div>
  );
}
