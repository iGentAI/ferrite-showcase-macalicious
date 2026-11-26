import { TagDot } from "macalicious/tag-dot";

/**
 * Visual comparison target: the icon column of the Tags section in the sidebar of Finder's
 * Open panel, 26 pt row pitch. Reference crop (2x pixels) x=146 y=910 w=44 h=300, i.e.
 * 22 x 150 pt. Dots start 4 pt from the left and 3 pt from the top (the first spans
 * x=154..177, y=917..938 with its antialiased rows). Rows: blue, none, orange, gray, green,
 * none; the panel's opaque sidebar colour (#e8e8e7) is behind them. The Dark Aqua capture of
 * the panel lists five tags, lower down: see visual-open-panel-tags-dark.
 */
export default function VisualOpenPanelTags() {
  const rows = ["blue", "none", "orange", "gray", "green", "none"] as const;
  return (
    <div
      style={{
        position: "relative",
        width: 22,
        height: 150,
        background: "light-dark(#e8e8e7, #2c2d2f)",
      }}
    >
      {rows.map((color, index) => (
        <TagDot
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list in which "none" repeats
          key={index}
          color={color}
          style={{ position: "absolute", left: 4, top: 3 + index * 26 }}
        />
      ))}
    </div>
  );
}
