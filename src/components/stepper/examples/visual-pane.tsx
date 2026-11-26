import { Stepper } from "macalicious/stepper";

/**
 * Visual comparison target: the stepper beside the "From" time field of the Notifications
 * preference pane.
 *
 * Reference crop (2x pixels) x=950 y=540 w=38 h=58, that is 19 x 29 pt. The bezel's outline
 * runs x 957 to 980 and y 547 to 588, so the alignment box, one hairline larger, starts 3 pt
 * from the crop's left and top edges.
 */
export default function VisualPane() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 19,
        height: 29,
        padding: "3px 0 0 3px",
        lineHeight: 0,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <Stepper aria-label="Time" defaultValue={10} />
    </div>
  );
}
