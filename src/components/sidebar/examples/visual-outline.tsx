import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";

/** Stand-in glyphs drawn for this example, not Disk Utility's artwork. */
const disk = (
  <svg
    viewBox="0 0 18 18"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <path d="M4 1.5h10l1 10v4.5H3v-4.5zM3 11.5h12" />
  </svg>
);
const eject = (
  <svg viewBox="0 0 8 9" width="8" height="9" style={{ marginInlineEnd: 3 }} aria-hidden="true">
    <path d="M4 0l4 5H0zM0 7h8v2H0z" fill="currentColor" />
  </svg>
);

/**
 * Visual comparison target: the device outline of Disk Utility
 * (10-15-Catalina-Light-Disk-Utility.png and the dark capture). The pane is 253 pt wide and
 * starts under the toolbar at image y=216; the crop x=114 y=216 w=504 h=600 (252 x 300 pt)
 * leaves out its first point, which holds the window's edge highlight. Three levels with
 * disclosure triangles, and the selection in the accent colour: the outline held the focus,
 * which `data-force` pins here.
 */
export default function VisualOutline() {
  return (
    <div style={{ position: "relative", overflow: "hidden", width: 252, height: 300 }}>
      <Sidebar
        aria-label="Devices"
        material="opaque"
        value="ssd"
        data-force="focus"
        style={{ position: "absolute", left: -1, width: 253, height: 300 }}
      >
        <SidebarSection title="Internal">
          <SidebarItem value="apple" label="APPLE SSD AP0512M Media" icon={disk} defaultExpanded>
            <SidebarItem value="disk1" label="Container disk1" icon={disk} defaultExpanded>
              <SidebarItem value="hd" label="Macintosh HD" icon={disk} />
              <SidebarItem value="hd-data" label="Macintosh HD - Data" icon={disk} />
            </SidebarItem>
          </SidebarItem>
        </SidebarSection>
        <SidebarSection title="External">
          <SidebarItem
            value="samsung"
            label="Samsung Portable SSD T3 Media"
            icon={disk}
            accessory={eject}
            defaultExpanded
          >
            <SidebarItem value="disk3" label="Container disk3" icon={disk} defaultExpanded>
              <SidebarItem value="ssd" label="Macintosh SSD" icon={disk} />
              <SidebarItem value="ssd-data" label="Macintosh SSD - Data" icon={disk} />
              <SidebarItem value="backup" label="Time Machine" icon={disk} accessory={eject} />
            </SidebarItem>
          </SidebarItem>
        </SidebarSection>
      </Sidebar>
    </div>
  );
}
