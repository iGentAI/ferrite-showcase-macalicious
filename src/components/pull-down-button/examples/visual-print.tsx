import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";

/**
 * Visual comparison target: the PDF pull-down button at the foot of the Print sheet, over the
 * sheet's material (about #b0c2d6 in Aqua and #2b4059 in Dark Aqua over the desktop picture; the
 * capture's backdrop is noisy by a few levels, the stand-in is flat).
 *
 * Aqua: the bezel's edges are at x 248 to 361 and y 961 to 1000 of the screenshot, a 58 pt box;
 * crop (2x pixels) x=239 y=952 w=132 h=60. Dark Aqua: outline at x 160 to 275 and y 931 to 970, a
 * 59 pt box; crop x=151 y=922 w=134 h=60. The box starts 4 pt from the crop's left and top.
 */
export default function VisualPrint() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "calc(66px + 1px * var(--mac-appearance-dark))",
        height: 30,
        padding: "4px 0 0 4px",
        background: "light-dark(#b0c2d6, #2b4059)",
      }}
    >
      <PullDownButton
        id="pdf"
        title="PDF"
        style={{ width: "calc(58px + 1px * var(--mac-appearance-dark))" }}
      >
        <MenuItem>Open in Preview</MenuItem>
        <MenuItem>Save as PDF</MenuItem>
        <MenuSeparator />
        <MenuItem>Send in Mail</MenuItem>
      </PullDownButton>
    </div>
  );
}
