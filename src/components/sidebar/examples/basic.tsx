import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";

/** Click a row, or focus the list and use the arrow keys or type a name. */
export default function Basic() {
  return (
    <Sidebar
      aria-label="Folders"
      defaultValue="documents"
      material="opaque"
      style={{ width: 180, height: 200 }}
    >
      <SidebarSection title="Favorites">
        <SidebarItem value="recents" label="Recents" />
        <SidebarItem value="documents" label="Documents" />
        <SidebarItem value="downloads" label="Downloads" />
      </SidebarSection>
      <SidebarSection title="iCloud">
        <SidebarItem value="drive" label="iCloud Drive" />
      </SidebarSection>
    </Sidebar>
  );
}
