import { Dock, DockItem, DockSeparator } from "macalicious/dock";
import type { CSSProperties } from "react";

const desktop: CSSProperties = {
  position: "relative",
  flex: 1,
  height: 130,
  background: "linear-gradient(light-dark(#7fb2d9, #25426e), light-dark(#062845, #081422))",
};

const icon = (hue: number) => (
  <span
    style={{
      width: "88%",
      height: "88%",
      borderRadius: "22%",
      background: `linear-gradient(hsl(${hue} 65% 64%), hsl(${hue} 65% 44%))`,
    }}
  />
);

/** The tile size is a CSS variable: 32 and 48 points here, 64 by default. */
export default function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, width: "100%" }}>
      {[32, 48].map((size) => (
        <div key={size} style={desktop}>
          <Dock
            aria-label={`Dock with ${size} point tiles`}
            style={{ "--mac-dock-tile-size": `${size}px` } as CSSProperties}
          >
            <DockItem label="Files" icon={icon(210)} running />
            <DockItem label="Notes" icon={icon(48)} />
            <DockSeparator />
            <DockItem label="Downloads" icon={icon(220)} />
          </Dock>
        </div>
      ))}
    </div>
  );
}
