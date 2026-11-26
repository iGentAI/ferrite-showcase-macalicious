import { CatalystSegment, CatalystSegmentedControl } from "macalicious/catalyst-segmented-control";
import { useState } from "react";

/** Three segments and a controlled value: the control tells its owner which view to show. */
export default function Segments() {
  const [range, setRange] = useState("week");
  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <CatalystSegmentedControl
        aria-label="Range"
        value={range}
        onValueChange={(value) => setRange(value as string)}
        style={{ width: 240 }}
      >
        <CatalystSegment value="day">Day</CatalystSegment>
        <CatalystSegment value="week">Week</CatalystSegment>
        <CatalystSegment value="month">Month</CatalystSegment>
      </CatalystSegmentedControl>
      <span style={{ font: "var(--mac-font-control-small)" }}>Showing: {range}</span>
    </div>
  );
}
