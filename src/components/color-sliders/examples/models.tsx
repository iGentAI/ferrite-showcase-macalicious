import { ColorSliders } from "macalicious/color-sliders";
import { useState } from "react";

/** The HSB sliders, controlled, over a swatch of the colour they report. */
export default function Models() {
  const [color, setColor] = useState("#34c759");
  return (
    <div style={{ display: "grid", gap: 12, width: 200 }}>
      <div
        role="img"
        aria-label={`Colour ${color}`}
        style={{ height: 24, borderRadius: 3, background: color }}
      />
      <ColorSliders defaultModel="hsb" value={color} onValueChange={setColor} />
    </div>
  );
}
