import { Ruler, type RulerMarker } from "macalicious/ruler";
import { useState } from "react";

/**
 * Visual check target for what no screenshot shows, 200 x 72 pt: a ruler with one draggable
 * left tab stop at 1 inch (the checks focus it with Tab and move it with the arrow keys), and
 * a decorative ruler with a centre, a right and a decimal tab stop at 36, 72 and 108 pt.
 */
export default function VisualStates() {
  const [markers, setMarkers] = useState<RulerMarker[]>([{ type: "left", position: 72 }]);
  return (
    <div style={{ display: "grid", gap: 8, width: 200 }}>
      <Ruler aria-label="Tab stops" markers={markers} onMarkersChange={setMarkers} />
      <Ruler
        markers={[
          { type: "center", position: 36 },
          { type: "right", position: 72 },
          { type: "decimal", position: 108 },
        ]}
      />
    </div>
  );
}
