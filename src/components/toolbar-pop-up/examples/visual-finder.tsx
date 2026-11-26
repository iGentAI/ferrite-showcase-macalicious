import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { SystemImage } from "macalicious/system-image";
import { ToolbarPullDown } from "macalicious/toolbar-pop-up";

/* A stand-in for the Group glyph, drawn for this library in the 14 pt box the screenshot's
   glyph occupies. The Action glyph is the `action` system image scaled to the same 14 pt.
   The comparison masks both. */
const rows = (
  <svg viewBox="0 0 14 13" width="14" height="13" aria-hidden="true" focusable="false">
    <path d="M0 .5h14M0 6.5h14M0 12.5h14" stroke="currentColor" />
    <path d="M0 2.5h4v2H0zM5 2.5h4v2H5zM10 2.5h4v2h-4zM0 8.5h4v2H0zM5 8.5h4v2H5zM10 8.5h4v2h-4z" />
  </svg>
);

const gear = <SystemImage name="action" scale={14 / 13} />;

/**
 * Visual comparison target: the Group and Action pull-down buttons of a Finder window's toolbar
 * (Finder-Network screenshots), over the toolbar's gradient.
 *
 * Reference crop (2x pixels) x=684 y=122 w=208 h=52 in Aqua and x=618 y=122 in Dark Aqua, i.e.
 * 104 x 26 pt. The fills are 46 x 22 pt, 2 pt from the crop's left and top edges and 8 pt apart;
 * the fixture also shows the page for 30 pt below, where `toolbar-pop-up.visual.json` opens the
 * Action menu.
 */
export default function VisualFinder() {
  return (
    <div
      data-testid="bar"
      style={{
        boxSizing: "border-box",
        display: "flex",
        gap: 8,
        width: 104,
        height: 26,
        padding: 2,
        background: "linear-gradient(light-dark(#dbdbdb, #3b3c3d), light-dark(#cecece, #343536))",
      }}
    >
      <ToolbarPullDown image={rows} aria-label="Group">
        <MenuItem>None</MenuItem>
        <MenuSeparator />
        <MenuItem>Name</MenuItem>
      </ToolbarPullDown>
      <ToolbarPullDown id="action" image={gear} aria-label="Action">
        <MenuItem data-testid="first">New Folder</MenuItem>
        <MenuItem>Get Info</MenuItem>
      </ToolbarPullDown>
    </div>
  );
}
