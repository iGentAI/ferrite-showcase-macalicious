import { Dock, DockItem, DockSeparator } from "macalicious/dock";
import { DockStack, DockStackItem, DockStackMore } from "macalicious/dock-stack";
import type { CSSProperties } from "react";

/** The desktop. The fan rises 64 points for each item above the Dock. */
const desktop: CSSProperties = {
  position: "relative",
  width: "100%",
  height: 440,
  background: "linear-gradient(light-dark(#7fb2d9, #25426e), light-dark(#062845, #081422))",
};

/** A stand-in thumbnail: a plain picture with the white border the Dock gives a photograph. */
function Picture({ hue }: { hue: number }) {
  return (
    <span
      style={{
        boxSizing: "border-box",
        width: 58,
        height: 40,
        border: "2px solid #ffffff",
        background: `linear-gradient(hsl(${hue} 55% 70%), hsl(${hue} 55% 40%))`,
        boxShadow: "0 1px 3px rgb(0 0 0 / 0.4)",
      }}
    />
  );
}

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
        <DockSeparator />
        <DockStack label="Downloads" icon={<Picture hue={220} />}>
          <DockStackMore>3 More in Finder</DockStackMore>
          <DockStackItem icon={<Picture hue={30} />}>Dunes.jpg</DockStackItem>
          <DockStackItem icon={<Picture hue={150} />}>Meadow.jpg</DockStackItem>
          <DockStackItem icon={<Picture hue={220} />}>Harbour.jpg</DockStackItem>
        </DockStack>
      </Dock>
    </div>
  );
}
