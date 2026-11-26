import { MediaAppChrome, MediaAppChromeSidebar } from "macalicious/media-app-chrome";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";

/**
 * Visual check only: a Sidebar inside the chrome keeps its own layout. The row's icon is a
 * grey block, so that its place, 18 pt from the edge, can be read from the capture. The
 * chrome's private variables once inherited into the Sidebar and removed that inset.
 */
export default function VisualSidebarInset() {
  return (
    <MediaAppChrome sidebarWidth={220} style={{ width: 260, height: 150 }}>
      <MediaAppChromeSidebar material="opaque">
        <Sidebar aria-label="Library" material="opaque" defaultValue="songs">
          <SidebarSection title="Library">
            <SidebarItem
              value="albums"
              label="Albums"
              icon={<span style={{ width: "100%", height: "100%", background: "#808080" }} />}
            />
            <SidebarItem value="songs" label="Songs" />
          </SidebarSection>
        </Sidebar>
      </MediaAppChromeSidebar>
    </MediaAppChrome>
  );
}
