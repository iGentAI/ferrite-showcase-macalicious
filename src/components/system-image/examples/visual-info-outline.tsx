import { SystemImage } from "macalicious/system-image";

/**
 * Visual comparison target: the info mark at the end of a Reminders row.
 *
 * Reference crop (2x pixels) x=1578 w=34 h=36, at y=962 in the Aqua capture (the Ruby row, on
 * the list's white) and y=686 in the Dark Aqua one (the selected Graphite row, #303133). That
 * is 17 x 18 pt, the 16 pt ring 1 pt from the crop's left and top edges. Reminders draws the
 * mark in the system blue: the captures store it as #2f7cf6 and #3686f7, which their colour
 * profile turns into #027aff and #0584fd in sRGB, the system blue of each appearance.
 */
export default function VisualInfoOutline() {
  return (
    <div
      style={{
        position: "relative",
        width: 17,
        height: 18,
        color: "var(--mac-color-system-blue)",
        background: "light-dark(#ffffff, #303133)",
      }}
    >
      <SystemImage name="info-outline" style={{ position: "absolute", left: 1, top: 1 }} />
    </div>
  );
}
