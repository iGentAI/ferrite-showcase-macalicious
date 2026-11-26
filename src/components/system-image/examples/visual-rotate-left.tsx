import { SystemImage } from "macalicious/system-image";

/**
 * Visual comparison target: the glyph of Quick Look's Rotate Left button.
 *
 * Reference crop (2x pixels) w=40 h=34: x=2697 y=109 in the Aqua capture, on the button's
 * white; x=2603 y=137 in the Dark Aqua one, where the glyph stands 0.5 pt further left in its
 * button, on the button's #667080 (the panel's material shows
 * through it). That is 20 x 17 pt, the 16 pt image 2 pt from the crop's left edge and at its
 * top. The glyph is #262626 in Aqua and #f2fbff in Dark Aqua.
 */
export default function VisualRotateLeft() {
  return (
    <div
      style={{
        position: "relative",
        width: 20,
        height: 17,
        color: "light-dark(#262626, #f2fbff)",
        background: "light-dark(#ffffff, #667080)",
      }}
    >
      <SystemImage name="rotate-left" style={{ position: "absolute", left: 2, top: 0 }} />
    </div>
  );
}
