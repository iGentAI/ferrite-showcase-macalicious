import { ColorPanel } from "macalicious/color-panel";
import { useState } from "react";

/** With `showsAlpha` the panel has an opacity slider and reports `#rrggbbaa`. */
export default function Opacity() {
  const [color, setColor] = useState("#34c75980");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <ColorPanel showsAlpha defaultMode="sliders" value={color} onValueChange={setColor} />
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
