import { ColorWheel } from "macalicious/color-wheel";
import { useState } from "react";

/** The wheel controlled by state, with the colour it reports beside it. */
export default function Controlled() {
  const [color, setColor] = useState("#ff9300");
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <ColorWheel value={color} onValueChange={setColor} style={{ width: 160 }} />
      <output
        style={{
          font: "var(--mac-font-control-regular)",
          color: "var(--mac-color-label)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {color}
      </output>
    </div>
  );
}
