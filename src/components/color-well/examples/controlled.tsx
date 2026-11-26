import { ColorWell } from "macalicious/color-well";
import { useState } from "react";

/** A controlled well: the chosen colour is shown beside it and tints a sample. */
export default function Controlled() {
  const [color, setColor] = useState("#ff2d55");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        font: "var(--mac-font-control-regular)",
        color: "var(--mac-color-label)",
      }}
    >
      <label htmlFor="accent-well">Accent:</label>
      <ColorWell id="accent-well" value={color} onValueChange={setColor} />
      <output htmlFor="accent-well" style={{ fontVariantNumeric: "tabular-nums" }}>
        {color}
      </output>
      <span
        aria-hidden="true"
        style={{ width: 12, height: 12, borderRadius: "50%", background: color }}
      />
    </div>
  );
}
