import { TagDot } from "macalicious/tag-dot";

/**
 * Visual comparison target: the icon column of the Tags section in a Finder sidebar
 * (Applications capture), 26 pt row pitch. Reference crop (2x pixels) w=44 h=412, i.e.
 * 22 x 206 pt, taken at x=146 y=936 in Aqua and x=146 y=988 in Dark Aqua (the dark window is
 * 26 pt lower). Dots start 4 pt from the left and 3 pt from the top. Rows in Aqua: blue,
 * none, orange, gray, green, none, red, All Tags; the opaque sidebar colour is behind them.
 */
export default function VisualSidebarTags() {
  const rows = ["blue", "none", "orange", "gray", "green", "none", "red", "all"] as const;
  return (
    <div
      style={{
        position: "relative",
        width: 22,
        height: 206,
        background: "light-dark(#e7e8e9, #2c2d2f)",
      }}
    >
      {rows.map((color, index) => (
        <TagDot
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list in which "none" repeats
          key={index}
          color={color}
          style={{ position: "absolute", left: color === "all" ? 3 : 4, top: 3 + index * 26 }}
        />
      ))}
    </div>
  );
}
