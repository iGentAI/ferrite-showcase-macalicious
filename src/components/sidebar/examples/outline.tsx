import { Sidebar, SidebarFooter, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { SidebarBadge } from "macalicious/sidebar-badge";
import { useState } from "react";

/**
 * An outline: rows with child rows get a disclosure triangle. Right and Left Arrow expand and
 * collapse the selected row. The selection is controlled here, and the example follows the
 * focus, so that the count of the selected row can be told that it is selected and whether
 * the selection is drawn in the accent colour (the list has the keyboard focus).
 */
export default function Outline() {
  const [value, setValue] = useState("summer");
  const [emphasized, setEmphasized] = useState(false);
  const count = (id: string, items: number) => (
    <SidebarBadge variant="plain" selected={value === id} emphasized={emphasized}>
      {items}
    </SidebarBadge>
  );
  return (
    <Sidebar
      aria-label="Library"
      value={value}
      onValueChange={setValue}
      // The list, not the button under it, draws the selection emphasised while it has focus.
      onFocus={(event) => setEmphasized(event.target.closest(".mac-sidebar-scroll") !== null)}
      onBlur={() => setEmphasized(false)}
      material="opaque"
      footer={<SidebarFooter>New Album</SidebarFooter>}
      style={{ width: 200, height: 264 }}
    >
      <SidebarSection title="Library">
        <SidebarItem value="photos" label="Photos" accessory={count("photos", 812)} />
        <SidebarItem value="favorites" label="Favorites" accessory={count("favorites", 24)} />
      </SidebarSection>
      <SidebarSection title="Albums">
        <SidebarItem value="mine" label="My Albums" defaultExpanded>
          <SidebarItem value="summer" label="Summer" accessory={count("summer", 57)} />
          <SidebarItem value="family" label="Family" accessory={count("family", 130)} />
        </SidebarItem>
        <SidebarItem value="shared" label="Shared Albums">
          <SidebarItem value="trip" label="Trip" />
        </SidebarItem>
      </SidebarSection>
    </Sidebar>
  );
}
