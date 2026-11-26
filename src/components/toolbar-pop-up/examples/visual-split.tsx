import { MenuItem } from "macalicious/menu-item";
import { ToolbarSplitPullDown } from "macalicious/toolbar-pop-up";

/* A stand-in for Preview's highlighter glyph, drawn for this library; the comparison masks it. */
const pen = (
  <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
    <path d="M2 12l1-4 6.5-6.5 3 3L6 11z" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

/**
 * Visual comparison target: the Highlight split button of Preview's toolbar, disabled because
 * nothing is selected (Preview screenshots), over the toolbar's gradient.
 *
 * Reference crop (2x pixels) x=1120 y=122 w=112 h=52 in Aqua and x=1866 y=122 in Dark Aqua, i.e.
 * 56 x 26 pt. The fill is 53 x 22 pt, 2 pt from the crop's left and top edges: a 33 pt main
 * part, a 1 pt divider and a 19 pt menu part.
 */
export default function VisualSplit() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        width: 56,
        height: 26,
        padding: 2,
        background: "linear-gradient(light-dark(#dbdbdb, #3e3f42), light-dark(#cfcfcf, #38393a))",
      }}
    >
      <ToolbarSplitPullDown
        disabled
        image={pen}
        aria-label="Highlight"
        menuLabel="Highlight colors"
        style={{ width: 34 }}
      >
        <MenuItem>Yellow</MenuItem>
      </ToolbarSplitPullDown>
    </div>
  );
}
