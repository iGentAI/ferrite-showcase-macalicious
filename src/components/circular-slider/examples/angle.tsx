"use client";

import { CircularSlider } from "macalicious/circular-slider";
import { useState } from "react";

/** Controlled: an angle in degrees, restricted to the twelve tick marks, shown beside the dial. */
export default function Angle() {
  const [angle, setAngle] = useState(90);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <CircularSlider
        aria-label="Rotation"
        aria-valuetext={`${angle} degrees`}
        max={360}
        tickMarks={12}
        tickMarkValuesOnly
        value={angle}
        onValueChange={setAngle}
      />
      <output style={{ font: "var(--mac-font-body)", minWidth: 32 }}>{angle % 360}°</output>
    </div>
  );
}
