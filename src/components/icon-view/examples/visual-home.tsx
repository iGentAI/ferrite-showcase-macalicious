import { IconView } from "macalicious/icon-view";
import { TagDot } from "macalicious/tag-dot";
import type { CSSProperties } from "react";

const folders = ["Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures", "Public"];

// Stand-in artwork for the folder icons: a plain folder shape, 148 pt wide in the 160 pt box.
const renderIcon = () => (
  <svg viewBox="0 0 160 160" width="160" height="160" style={{ color: "#6cc4f5" }}>
    <title>Folder</title>
    <path
      d="M6 30q0-8 8-8h38q6 0 10 6l4 5h80q8 0 8 8v90q0 8-8 8H14q-8 0-8-8z"
      fill="currentColor"
    />
  </svg>
);

const renderTag = (index: number) => (index === 1 ? <TagDot color="green" size="small" /> : null);

/**
 * Visual comparison target: the icon view of a home folder with 160 pt icons,
 * 10-15-Catalina-Light-Finder-Home.png (crop x=444 y=286 w=1878 h=1240, 2x pixels: the 939 pt
 * wide view, five columns 186 pt apart) and 10-15-Catalina-Dark-Finder-Home.png (x=442 y=286
 * w=1818 h=1120: 909 pt wide, four columns 217 pt apart). The rows are 226 pt apart and the
 * name of Documents is preceded by a green tag dot. The example takes the size of the crop of
 * its appearance. The folders are stand-ins, and masked in the comparison. The last point of
 * the Dark Aqua crop is the window's edge highlight, which the example paints. The background
 * is Finder's, set through the view's `--mac-icon-view-background`: the masked comparisons
 * score it.
 */
export default function VisualHome() {
  return (
    <IconView
      aria-label="Home"
      count={folders.length}
      iconSize={160}
      rowHeight={226}
      renderIcon={renderIcon}
      renderTag={renderTag}
      getItemLabel={(index) => folders[index] ?? ""}
      style={
        {
          width: "calc(939px - 30px * var(--mac-appearance-dark))",
          height: "calc(620px - 60px * var(--mac-appearance-dark))",
          "--mac-icon-view-background": "light-dark(#ffffff, #1e2022)",
          boxShadow: "inset -1px 0 light-dark(transparent, #4b4d4e)",
        } as CSSProperties
      }
    />
  );
}
