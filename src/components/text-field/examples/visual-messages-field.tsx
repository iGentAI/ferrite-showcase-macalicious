import { TextField } from "macalicious/text-field";

/**
 * Visual comparison target: the message field at the bottom of a Messages transcript, the
 * capsule bezel, empty with its placeholder.
 *
 * Reference crop (2x pixels) w=830 h=68, that is 415 x 34 pt of the bar, at x=1306 y=1068 in
 * the Aqua capture and x=1318 y=1060 in the Dark Aqua one. The field's edge runs from 5 pt
 * inside the crop's left and top: 403 x 24 pt. The bar's fill is #f0f0f0 in Aqua and #292929 in
 * Dark Aqua. The emoji button at the field's trailing end is Messages' own artwork; the
 * comparisons mask it.
 */
export default function VisualMessagesField() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 415,
        height: 34,
        padding: "5px 0 0 5px",
        lineHeight: 0,
        background: "light-dark(#f0f0f0, #292929)",
      }}
    >
      <TextField
        bezel="capsule"
        aria-label="Message"
        placeholder="iMessage"
        style={{ width: 403 }}
      />
    </div>
  );
}
