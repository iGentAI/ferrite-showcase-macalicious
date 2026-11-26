import { TextField } from "macalicious/text-field";

/**
 * Visual comparison target: the Computer Name field of System Preferences > Sharing.
 *
 * Reference crop (2x pixels) x=424 y=198 w=928 h=50, that is 464 x 25 pt of window background
 * with the field's edge at x 429 to 1346 and y 203 to 242: 459 x 20 pt, 2.5 pt from the
 * crop's left and top.
 */
export default function VisualSharing() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 464,
        height: 25,
        padding: "2.5px 0 0 2.5px",
        lineHeight: 0,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <TextField aria-label="Computer Name" defaultValue="ismh15" style={{ width: 459 }} />
    </div>
  );
}
