import { TagDot } from "macalicious/tag-dot";

/**
 * Visual comparison target: the icon column of the Tags section in the sidebar of Finder's
 * Open panel in the Dark Aqua capture, which lists five tags, 26 pt row pitch. Reference crop
 * (2x pixels) x=146 y=962 w=44 h=248, i.e. 22 x 124 pt. Dots start 4 pt from the left and
 * 3 pt from the top (the first spans x=154..177, y=968..991). Rows: blue, none, orange, gray,
 * green; the panel's opaque sidebar colour (#2c2d2e) is behind them.
 */
export default function VisualOpenPanelTagsDark() {
  const rows = ["blue", "none", "orange", "gray", "green"] as const;
  return (
    <div
      style={{
        position: "relative",
        width: 22,
        height: 124,
        background: "light-dark(#e8e8e7, #2c2d2e)",
      }}
    >
      {rows.map((color, index) => (
        <TagDot
          key={color}
          color={color}
          style={{ position: "absolute", left: 4, top: 3 + index * 26 }}
        />
      ))}
    </div>
  );
}
