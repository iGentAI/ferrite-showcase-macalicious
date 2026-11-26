import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import type { CSSProperties } from "react";

/**
 * Stand-in icons drawn for this example, not Music's: an 18 pt rounded square in a flat
 * colour near the one Music uses, with a white dot where Music has a glyph.
 */
function Tile({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <rect width="18" height="18" rx="4" fill={color} />
      <circle cx="9" cy="9" r="3.5" fill="#ffffff" />
    </svg>
  );
}

/**
 * Music's source list: its rows touch (a 24 pt pitch), a header's slot is 30 pt, the label
 * starts 5 pt after the icon, and the headers sit 2 pt lower than the default.
 */
const music = {
  "--mac-sidebar-row-spacing": "0px",
  "--mac-sidebar-section-gap": "10px",
  "--mac-sidebar-label-gap": "5px",
  "--mac-sidebar-header-inset": "4px",
} as CSSProperties;

/**
 * Visual comparison target: the source list of Music in 10-15-Catalina-Light-Music.png and
 * 10-15-Catalina-Dark-Music.png (window at image x=112 y=76 in both). The pane is 220 pt
 * wide; the list is compared from 92 pt under the window's top, 5 pt above the first header's
 * 20 pt box, down to 5 pt under the last row: 282 pt. The crop (x=114 y=260 w=438 h=564, i.e.
 * 219 x 282 pt) leaves out the pane's first point, which holds the window's edge.
 *
 * Albums is selected and the list does not hold the focus. The spacing is Music's, set with
 * the sidebar's four custom properties; everything else is the sidebar's default.
 */
export default function VisualMusic() {
  return (
    <div style={{ position: "relative", overflow: "hidden", width: 219, height: 282 }}>
      <Sidebar
        aria-label="Library"
        material="opaque"
        value="albums"
        style={{ position: "absolute", left: -1, width: 220, height: 320, ...music }}
      >
        <SidebarSection title="Apple Music">
          <SidebarItem value="for-you" label="For You" icon={<Tile color="#ff5c75" />} />
          <SidebarItem value="browse" label="Browse" icon={<Tile color="#fb5c93" />} />
          <SidebarItem value="radio" label="Radio" icon={<Tile color="#f65bb4" />} />
        </SidebarSection>
        <SidebarSection title="Library">
          <SidebarItem value="recent" label="Recently Added" icon={<Tile color="#b665e8" />} />
          <SidebarItem value="artists" label="Artists" icon={<Tile color="#a067ee" />} />
          <SidebarItem value="albums" label="Albums" icon={<Tile color="#7f6bf3" />} />
          <SidebarItem value="songs" label="Songs" icon={<Tile color="#6c78f5" />} />
        </SidebarSection>
        <SidebarSection title="Store">
          <SidebarItem value="store" label="iTunes Store" icon={<Tile color="#e45fd2" />} />
        </SidebarSection>
      </Sidebar>
    </div>
  );
}
