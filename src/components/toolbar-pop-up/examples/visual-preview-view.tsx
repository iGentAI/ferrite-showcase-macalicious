import { MenuItem } from "macalicious/menu-item";
import { ToolbarPullDown } from "macalicious/toolbar-pop-up";

/* A stand-in for Preview's sidebar glyph, drawn for this library in the 15 x 12 pt box the
   screenshot's glyph occupies. The comparison masks it. */
const sidebar = (
  <svg viewBox="0 0 15 12" width="15" height="12" aria-hidden="true" focusable="false">
    <rect x=".5" y=".5" width="14" height="11" rx="1.5" fill="none" stroke="currentColor" />
    <path d="M5.5.5v11" stroke="currentColor" />
  </svg>
);

/**
 * Visual comparison target: the View pull-down button of a Preview window's toolbar, the
 * compact form, over the toolbar's gradient.
 *
 * Reference crop (2x pixels) x=124 y=122 w=80 h=52 in both Preview screenshots, i.e. 40 x 26
 * pt. The fill is 36 x 22 pt, 2 pt from the crop's left and top edges: 5 pt, the 15 pt glyph,
 * 4 pt, the 7 pt chevron, 5 pt. Preview's glyphs are lighter than Finder's, which the toolbar
 * button's text token is measured on (#737373 on #f6f6f6 where Finder has #565656; #fbfbfb on
 * #686969 in Dark Aqua), so the example sets that token to Preview's ink: the comparison is of
 * the compact layout.
 */
export default function VisualPreviewView() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 40,
        height: 26,
        padding: 2,
        background: "linear-gradient(light-dark(#dbdbdb, #3e3f42), light-dark(#cecece, #38393b))",
        ["--mac-toolbar-button-text" as string]:
          "light-dark(rgb(0 0 0 / 0.53), rgb(255 255 255 / 0.97))",
      }}
    >
      <ToolbarPullDown compact image={sidebar} aria-label="View">
        <MenuItem>Hide Sidebar</MenuItem>
      </ToolbarPullDown>
    </div>
  );
}
