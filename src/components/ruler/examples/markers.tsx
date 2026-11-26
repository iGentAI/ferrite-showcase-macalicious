import { Ruler, type RulerMarker } from "macalicious/ruler";
import { useState } from "react";

/**
 * Every marker type, draggable: drag a marker, or focus it with Tab and use the arrow keys.
 * A marker moves by ticks (an eighth of an inch here).
 */
export default function Markers() {
  const [markers, setMarkers] = useState<RulerMarker[]>([
    { type: "first-line-indent", position: 18 },
    { type: "head-indent", position: 0 },
    { type: "left", position: 72 },
    { type: "center", position: 144 },
    { type: "right", position: 216 },
    { type: "decimal", position: 288 },
    { type: "tail-indent", position: 387 },
  ]);
  return (
    <Ruler
      aria-label="Paragraph ruler"
      style={{ width: 400 }}
      markers={markers}
      onMarkersChange={setMarkers}
    />
  );
}
