import { Dock, DockItem, DockSeparator } from "macalicious/dock";
import type { CSSProperties } from "react";

/** The desktop: the Dock sits on the bottom edge of the nearest positioned element. */
const desktop: CSSProperties = {
  position: "relative",
  width: "100%",
  height: 150,
  background: "linear-gradient(light-dark(#7fb2d9, #25426e), light-dark(#062845, #081422))",
};

/** A stand-in icon: a plain rounded tile. An application supplies its own artwork. */
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

export default function Basic() {
  return (
    <div style={desktop}>
      <Dock>
        <DockItem label="Files" icon={<Tile hue={210} />} running />
        <DockItem label="Mail" icon={<Tile hue={195} />} />
        <DockItem label="Notes" icon={<Tile hue={48} />} running />
        <DockSeparator />
        <DockItem label="Downloads" icon={<Tile hue={220} />} />
      </Dock>
    </div>
  );
}
