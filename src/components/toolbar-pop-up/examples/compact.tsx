import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { SystemImage } from "macalicious/system-image";
import { ToolbarPullDown } from "macalicious/toolbar-pop-up";

/**
 * The compact form beside the regular one, with the same glyph: Preview's View button is the
 * compact one. The chevron is a little smaller and sits closer to the glyph.
 */
export default function Compact() {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: 12,
        background: "var(--mac-material-titlebar)",
      }}
    >
      <ToolbarPullDown compact image={<SystemImage name="sidebar" />} aria-label="View, compact">
        <MenuItem>Hide Sidebar</MenuItem>
        <MenuSeparator />
        <MenuItem>Thumbnails</MenuItem>
        <MenuItem>Table of Contents</MenuItem>
      </ToolbarPullDown>
      <ToolbarPullDown image={<SystemImage name="sidebar" />} aria-label="View, regular">
        <MenuItem>Hide Sidebar</MenuItem>
        <MenuSeparator />
        <MenuItem>Thumbnails</MenuItem>
        <MenuItem>Table of Contents</MenuItem>
      </ToolbarPullDown>
    </div>
  );
}
