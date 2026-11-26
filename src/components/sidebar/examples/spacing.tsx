import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import type { CSSProperties } from "react";

/** A stand-in icon drawn for this example: an 18 pt rounded square. */
const tile = (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <rect width="18" height="18" rx="4" fill="currentColor" />
  </svg>
);

/** Music's spacing: rows that touch, 10 pt above a section, the label 5 pt after the icon. */
const music = {
  "--mac-sidebar-row-spacing": "0px",
  "--mac-sidebar-section-gap": "10px",
  "--mac-sidebar-label-gap": "5px",
} as CSSProperties;

function Library({ name, style }: { name: string; style?: CSSProperties }) {
  return (
    <Sidebar
      aria-label={name}
      material="opaque"
      defaultValue="albums"
      style={{ width: 170, ...style }}
    >
      <SidebarSection title="Library">
        <SidebarItem value="artists" label="Artists" icon={tile} />
        <SidebarItem value="albums" label="Albums" icon={tile} />
        <SidebarItem value="songs" label="Songs" icon={tile} />
      </SidebarSection>
      <SidebarSection title="Store">
        <SidebarItem value="store" label="iTunes Store" icon={tile} />
      </SidebarSection>
    </Sidebar>
  );
}

/** The default spacing, and the same list with the spacing of Music's source list. */
export default function Spacing() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "start" }}>
      <Library name="Library, default spacing" />
      <Library name="Library, Music's spacing" style={music} />
    </div>
  );
}
