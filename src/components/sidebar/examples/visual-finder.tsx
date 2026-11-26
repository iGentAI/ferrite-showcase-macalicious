import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { TagDot } from "macalicious/tag-dot";
import type { CSSProperties } from "react";

/** Stand-in glyphs drawn for this example: outlines in the row's tint, not Apple's icons. */
function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 18 18"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const rings = "M9 9h.01M5.5 12.5a5 5 0 1 1 7 0M3 15a8.2 8.2 0 1 1 12 0";
const tray = "M2 10l2-7h10l2 7v5H2zM2 10h4l1 2h4l1-2h4";
const letter = "M4 15L9 3l5 12M2 11h14";
const screen = "M2 3h14v10H2zM6 16h6";
const page = "M4 2h7l3 3v11H4zM11 2v3h3";
const arrow = "M9 1.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15zM9 5v7M6 9.5l3 3l3-3";
const cloud = "M5 14a3.5 3.5 0 0 1 0-7a4.5 4.5 0 0 1 8.5 1a3 3 0 0 1-.5 6z";
const drive = "M4 2h10l1 9v4H3v-4zM3 11h12";
const globe =
  "M9 1.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15zM1.5 9h15M9 1.5c-5 5-5 10 0 15c5-5 5-10 0-15";

const marker: CSSProperties = { position: "absolute", left: 0, width: 163 };

/**
 * Visual comparison target: the Finder sidebar of 10-15-Catalina-Dark-Applications.png and,
 * down to the Locations header and from the Tags header on, of
 * 10-15-Catalina-Light-Applications.png (its Locations section has one row less). The pane
 * is 164 pt wide and starts under the toolbar at image y=186; the captures leave out its first
 * point, which holds the window's edge highlight, and the divider after it.
 *
 * Two regions are compared, marked by empty elements: `top` (163 x 264 pt from the pane's
 * top, crop x=114 y=186 w=326 h=528) and `tags` (163 x 240 pt from the end of the Locations
 * rows, crop y=872 in the light capture and y=924 in the dark one, w=326 h=480). Applications
 * is selected and the sidebar does not hold the focus. Finder sets its headers 1 pt lower than
 * other sidebars, hence the header inset.
 */
export default function VisualFinder() {
  return (
    <div style={{ position: "relative", overflow: "hidden", width: 163, height: 624 }}>
      <Sidebar
        aria-label="Sidebar"
        material="opaque"
        value="applications"
        style={
          {
            position: "absolute",
            left: -1,
            width: 164,
            height: 624,
            "--mac-sidebar-header-inset": "3px",
          } as CSSProperties
        }
      >
        <SidebarSection title="Favorites">
          <SidebarItem value="airdrop" label="AirDrop" icon={<Glyph d={rings} />} />
          <SidebarItem value="recents" label="Recents" icon={<Glyph d={tray} />} />
          <SidebarItem value="applications" label="Applications" icon={<Glyph d={letter} />} />
          <SidebarItem value="desktop" label="Desktop" icon={<Glyph d={screen} />} />
          <SidebarItem value="documents" label="Documents" icon={<Glyph d={page} />} />
          <SidebarItem value="downloads" label="Downloads" icon={<Glyph d={arrow} />} />
        </SidebarSection>
        <SidebarSection title="iCloud">
          <SidebarItem value="icloud" label="iCloud Drive" icon={<Glyph d={cloud} />} />
        </SidebarSection>
        <SidebarSection title="Locations">
          <SidebarItem value="hd" label="Macintosh HD" icon={<Glyph d={drive} />} />
          <SidebarItem value="backup" label="Time Machine" icon={<Glyph d={drive} />} />
          <SidebarItem value="computer" label="ismhpro" icon={<Glyph d={screen} />} />
          <SidebarItem value="network" label="Network" icon={<Glyph d={globe} />} />
        </SidebarSection>
        <SidebarSection title="Tags">
          <SidebarItem value="blue" label="Blue" icon={<TagDot color="blue" />} />
          <SidebarItem value="work" label="Work" icon={<TagDot />} />
          <SidebarItem value="orange" label="Orange" icon={<TagDot color="orange" />} />
          <SidebarItem value="gray" label="Gray" icon={<TagDot color="gray" />} />
          <SidebarItem value="green" label="Green" icon={<TagDot color="green" />} />
          <SidebarItem value="home" label="Home" icon={<TagDot />} />
          <SidebarItem value="red" label="Red" icon={<TagDot color="red" />} />
          <SidebarItem value="all" label="All Tags…" icon={<TagDot color="all" />} />
        </SidebarSection>
      </Sidebar>
      <div data-visual="top" style={{ ...marker, top: 0, height: 264 }} />
      <div data-visual="tags" style={{ ...marker, top: 369, height: 240 }} />
    </div>
  );
}
