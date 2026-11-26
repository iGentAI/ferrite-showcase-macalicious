import { SearchField } from "macalicious/search-field";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import type { CSSProperties } from "react";

// Reminders' field is 21 pt high and its edges are half a point inside the 16 pt margins.
const field = {
  width: "calc(100% - 1px)",
  marginInline: 0.5,
  "--mac-search-field-height": "21px",
} as CSSProperties;

/**
 * Visual comparison target: the search field over the lists of the Reminders sidebar, given
 * to the sidebar as its `header`.
 *
 * Reference crop (2x pixels) x=114 y=136 w=556 h=114 of Light- and Dark-Reminders, i.e. 278 x
 * 57 pt: the pane without its first and last point, from 30 pt under the window's top (below
 * the window controls) to just above the smart-list tiles. The field runs from x 145 to 638
 * and from y 181 to 222: 16.5 pt from the pane's edge and 52.5 pt under the window's top, on
 * the pane's material. Those distances are Reminders' own and are set on the header's
 * content; the glass and the placeholder are masked.
 */
export default function VisualRemindersHeader() {
  return (
    <div style={{ width: 278, height: 57, overflow: "hidden" }}>
      <Sidebar
        aria-label="Lists"
        material="opaque"
        style={{ width: 280, height: 200, margin: "-30px 0 0 -1px" }}
        header={
          <div style={{ padding: "52.5px 16px 14.5px" }}>
            <SearchField variant="sidebar" style={field} />
          </div>
        }
      >
        <SidebarSection title="My Lists">
          <SidebarItem value="reminders" label="Reminders" />
          <SidebarItem value="work" label="Work" />
        </SidebarSection>
      </Sidebar>
    </div>
  );
}
