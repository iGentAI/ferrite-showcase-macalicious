import { Dock, DockItem, DockSeparator } from "macalicious/dock";
import { DockStack, DockStackItem, DockStackMore } from "macalicious/dock-stack";
import type { CSSProperties } from "react";

const desktop: CSSProperties = {
  position: "relative",
  width: "100%",
  height: 330,
  background: "linear-gradient(light-dark(#7fb2d9, #25426e), light-dark(#062845, #081422))",
};

const FILES = [
  ["Dunes.jpg", 30],
  ["Meadow.jpg", 150],
  ["Harbour.jpg", 220],
  ["Orchard.jpg", 95],
  ["Glacier.jpg", 190],
] as const;

/** A stand-in picture that fills the box it is given: 64 points in a grid, 16 in a list. */
function Picture({ hue }: { hue: number }) {
  return (
    <span
      style={{
        boxSizing: "border-box",
        width: "92%",
        height: "66%",
        border: "1px solid #ffffff",
        background: `linear-gradient(hsl(${hue} 55% 70%), hsl(${hue} 55% 40%))`,
      }}
    />
  );
}

/** The same folder as a grid and as a list. Both views are provisional. */
export default function Views() {
  return (
    <div style={desktop}>
      <Dock>
        <DockItem label="Files" icon={<Picture hue={210} />} running />
        <DockSeparator />
        {(["grid", "list"] as const).map((view) => (
          <DockStack
            key={view}
            view={view}
            label={`Pictures, ${view}`}
            icon={<Picture hue={220} />}
          >
            {FILES.map(([name, hue]) => (
              <DockStackItem key={name} icon={<Picture hue={hue} />}>
                {name}
              </DockStackItem>
            ))}
            <DockStackMore>Open in Finder</DockStackMore>
          </DockStack>
        ))}
      </Dock>
    </div>
  );
}
