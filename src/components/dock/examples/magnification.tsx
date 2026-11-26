import { Dock, DockItem, DockSeparator } from "macalicious/dock";
import type { CSSProperties } from "react";

const desktop: CSSProperties = {
  position: "relative",
  width: "100%",
  height: 190,
  background: "linear-gradient(light-dark(#7fb2d9, #25426e), light-dark(#062845, #081422))",
};

const HUES = [210, 195, 48, 130, 280, 12, 330];

/** Small tiles that grow to 96 points under the pointer. The icons fill their tile. */
export default function Magnification() {
  return (
    <div style={desktop}>
      <Dock magnification={96} style={{ "--mac-dock-tile-size": "48px" } as CSSProperties}>
        {HUES.map((hue, index) => (
          <DockItem
            key={hue}
            label={`Application ${index + 1}`}
            icon={
              <span
                style={{
                  width: "88%",
                  height: "88%",
                  borderRadius: "22%",
                  background: `linear-gradient(hsl(${hue} 65% 64%), hsl(${hue} 65% 44%))`,
                }}
              />
            }
          />
        ))}
        <DockSeparator />
        <DockItem
          label="Downloads"
          icon={
            <span
              style={{
                width: "88%",
                height: "88%",
                borderRadius: "22%",
                background: "linear-gradient(hsl(220 15% 80%), hsl(220 15% 60%))",
              }}
            />
          }
        />
      </Dock>
    </div>
  );
}
