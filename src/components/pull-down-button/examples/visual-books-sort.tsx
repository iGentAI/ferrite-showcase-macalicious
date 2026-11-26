import { MenuItem } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";
import type { CSSProperties } from "react";

/*
 * Books' "Sort By" button, measured in the two Books screenshots: the title in the label
 * colour (#262626 on white, #dddddd on #1e2022: black and white at 85%) and the chevron a
 * little lighter (#3b3b3b and #cacbcb: black at 77%, white at 76.5%), set with the two colour
 * hooks of a button without a bezel. The title is 12 pt there (capitals 8.5 pt high); the
 * medium weight is a judgement by eye.
 */
const books = {
  "--mac-pop-up-button-borderless-color": "var(--mac-color-label)",
  "--mac-pop-up-button-borderless-arrow-color":
    "light-dark(rgb(0 0 0 / 0.77), rgb(255 255 255 / 0.765))",
  width: 55.5,
  marginTop: -3.5,
  // The capture has the chevron half a device pixel off the pixel grid in both directions.
  // The translation gives the example's chevron the same phase against the pixel grid, so
  // that it is rasterised as the capture's is.
  transform: "translate(0.25px, 0.25px)",
  font: "var(--mac-font-weight-medium) 12px / 15px var(--mac-font-family-system)",
} as CSSProperties;

/**
 * Visual comparison target: the "Sort By" pull-down button without a bezel at the right of
 * the bar under the toolbar of Books' library window.
 *
 * Reference crop (2x pixels) x=2338 y=192 w=120 h=30 in both Books screenshots, i.e. 60 x
 * 15 pt on the window's flat content background. The title's ink starts 3.5 pt from the
 * crop's left edge; the chevron's ink runs from 49.5 to 57 pt, 6.2 pt after the title's ink,
 * with its tip 9 pt under the crop's top. The crop is 15 pt high where the regular button is
 * 21 pt, so the button starts 3.5 pt above it; the width pins the chevron, whatever the font.
 */
export default function VisualBooksSort() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        boxSizing: "border-box",
        width: 60,
        height: 15,
        paddingLeft: 3,
        background: "light-dark(#ffffff, #1e2022)",
      }}
    >
      <PullDownButton bordered={false} title="Sort By" style={books}>
        <MenuItem>Most Recent</MenuItem>
        <MenuItem>Title</MenuItem>
        <MenuItem>Author</MenuItem>
        <MenuItem>Manually</MenuItem>
      </PullDownButton>
    </div>
  );
}
