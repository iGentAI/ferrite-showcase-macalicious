import { SearchField } from "macalicious/search-field";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { useState } from "react";

const folders = ["Notes", "Recipes", "Travel", "Work", "Receipts", "Ideas", "Archive"];

/**
 * A search field as the sidebar's `header`: it stays at the top of the pane, on the pane's
 * material, while the folders scroll under it. The header is laid out by its own styles, here
 * 8 pt of space around the field.
 */
export default function Header() {
  const [query, setQuery] = useState("");
  const shown = folders.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  return (
    <Sidebar
      aria-label="Folders"
      material="opaque"
      defaultValue="Notes"
      style={{ width: 180, height: 170 }}
      header={
        <div style={{ padding: 8 }}>
          <SearchField
            variant="sidebar"
            aria-label="Search folders"
            value={query}
            onValueChange={setQuery}
            style={{ width: "100%" }}
          />
        </div>
      }
    >
      <SidebarSection title="Folders">
        {shown.map((name) => (
          <SidebarItem key={name} value={name} label={name} />
        ))}
      </SidebarSection>
    </Sidebar>
  );
}
