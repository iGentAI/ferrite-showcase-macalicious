import { Dock, DockItem, DockSeparator } from "macalicious/dock";
import type { CSSProperties } from "react";

const desktop: CSSProperties = {
  position: "relative",
  flex: 1,
  height: 300,
  background: "linear-gradient(light-dark(#7fb2d9, #25426e), light-dark(#062845, #081422))",
};

function Tile({ hue }: { hue: number }) {
  return (
    <span
      style={{
        width: 56,
        height: 56,
        borderRadius: 13,
        background: `linear-gradient(hsl(${hue} 65% 64%), hsl(${hue} 65% 44%))`,
      }}
    />
  );
}

/** The Dock on the left and on the right edge: a column, moved through with Up and Down. */
export default function Positions() {
  return (
    <div style={{ display: "flex", gap: 12, width: "100%" }}>
      {(["left", "right"] as const).map((position) => (
        <div key={position} style={desktop}>
          <Dock position={position} aria-label={`Dock on the ${position}`}>
            <DockItem label="Files" icon={<Tile hue={210} />} running />
            <DockItem label="Notes" icon={<Tile hue={48} />} />
            <DockSeparator />
            <DockItem label="Downloads" icon={<Tile hue={220} />} />
          </Dock>
        </div>
      ))}
    </div>
  );
}
